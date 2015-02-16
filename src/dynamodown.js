import {AbstractLevelDOWN, AbstractIterator} from "abstract-leveldown"
import xtend from "xtend"

const serialize = function(value) {
  if (value === "") value = {NULL: true}

  const type = toString.call(value).slice(8, -1)
  const reduce = function(value) {
    return Object.keys(value).reduce(function(acc, key) {
      acc[key] = serialize(value[key])
      return acc
    }, {})
  }

  switch (type) {
    case "Null"    : return {NULL: true}
    case "String"  : return {S: value}
    case "Buffer"  : return {B: value.toString("base64")}
    case "Boolean" : return {BOOL: value}
    case "Number"  : return {N: String(value)}
    case "Array"   : return {L: value.map(serialize)}
    case "Object"  : return {M: reduce(value)}
    // TODO: Support sets

    default        : throw new Error(`Cannot serialize ${type}`)
  }
}

const parse = function(val) {
  const type = Object.keys(val)[0]
  const value = val[type]
  const reduce = function(value) {
    return Object.keys(value).reduce(function(acc, key) {
      acc[key] = parse(value[key])
      return acc
    }, {})
  }

  switch (type) {
    case "NULL" : return null
    case "S"    : return value
    case "B"    : return Buffer(value, "base64")
    case "BOOL" : return value
    case "N"    : return parseFloat(value, 10)
    case "L"    : return value.map(parse)
    case "M"    : return reduce(value)
    // TODO: Support sets

    default     : throw new Error(`Cannot parse ${type}.`)
  }
}

class DynamoIterator extends AbstractIterator {
  constructor(db, options) {
    super(db)

    this._limit = Infinity
    if (options.limit !== -1) this._limit = options.limit

    this._reverse = false
    if (options.reverse === true) this._reverse = true

    if ("gt" in options || "gte" in options) {
      this._lowerBound = {
        key: options.gt || options.gte,
        inclusive: "gte" in options
      }
    }

    if ("lt" in options || "lte" in options) {
      this._upperBound = {
        key: options.lt || options.lte,
        inclusive: "lte" in options
      }
    }

    this._params = {
      TableName: this.db._table.name,
      KeyConditions: {}
    }

    if (this._limit !== Infinity) this._params.Limit = this._limit
    if (this._reverse) this._params.ScanIndexForward = false

    this._params.KeyConditions[this.db._schema.hash.name] = {
      ComparisonOperator: "EQ",
      AttributeValueList: [serialize(this.db._schema.hash.value)]
    }

    if (this._lowerBound && this._upperBound) {
      this._params.KeyConditions[this.db._schema.range.name] = {
        ComparisonOperator: "BETWEEN",
        AttributeValueList: [
          serialize(this._lowerBound.key),
          serialize(this._upperBound.key)
        ]
      }
    }

    else if (this._lowerBound) {
      this._params.KeyConditions[this.db._schema.range.name] = {
        ComparisonOperator: this._lowerBound.inclusive ? "GE" : "GT",
        AttributeValueList: [serialize(this._lowerBound.key)]
      }
    }

    else if (this._upperBound) {
      this._params.KeyConditions[this.db._schema.range.name] = {
        ComparisonOperator: this._upperBound.inclusive ? "LE" : "LT",
        AttributeValueList: [serialize(this._upperBound.key)]
      }
    }

    this._items = []
    this._cursor = 0
  }

  _next(cb) {
    const item = this._items[this._cursor]

    if (item) {
      // make sure not excluded from gt/lt key conditions
      setImmediate(cb, null, item.key, item.value)
      delete this._items[this._cursor]
      this._cursor++
      return
    }

    if (item === null || this._cursor === this._limit) {
      setImmediate(cb)
      return
    }

    this.db._db.query(this._params, (err, data) => {
      if (err) return cb(err)

      const {Items, LastEvaluatedKey} = data

      for (let item of Items) this._items.push(this.db._toKV(item))

      if (!LastEvaluatedKey) this._items.push(null)

      this._params.ExclusiveStartKey = LastEvaluatedKey
      this._next(cb)
    })
  }
}

class DynamoDOWN extends AbstractLevelDOWN {
  constructor(db, location) {
    super(location)

    const [table, hash] = location.split("/")

    this._db = db
    this._table = {name: table}
    this._schema = {
      hash: {value: hash},
      range: {}
    }
  }

  _toItem({key, value}) {
    const item = xtend(value)

    item[this._schema.hash.name] = this._schema.hash.value
    item[this._schema.range.name] = key

    return serialize(item).M
  }

  _toKV(item) {
    const value = parse({M: item})
    const key = value[this._schema.range.name]

    delete value[this._schema.range.name]
    delete value[this._schema.hash.name]

    return {key, value}
  }

  _open(options, cb) {
    const params = {TableName: this._table.name}
    const ontable = (err, data) => {
      if (err) return cb(err)

      for (let {KeyType, AttributeName} of data.Table.KeySchema) {
        this._schema[KeyType.toLowerCase()].name = AttributeName
      }

      cb()
    }

    this._db.describeTable(params, ontable)
  }

  _get(key, options, cb) {
    const TableName = this._table.name
    const {valueEncoding} = options
    const Key = this._toItem({key})
    const params = {TableName, Key}

    this._db.getItem(params, (err, data) => {
      if (err) return cb(err)

      if (!data.Item) return cb(new Error("NotFound"))

      const {value} = this._toKV(data.Item)
      const isValue = valueEncoding !== "json"

      let item = isValue ? value.value : JSON.stringify(value)
      if (options.asBuffer !== false) item = new Buffer(item)

      cb(null, item)
    })
  }

  _put(key, value, options, cb) {
    const TableName = this._table.name
    const {valueEncoding} = options

    value = valueEncoding === "json" ? JSON.parse(value) : {value}

    const Item = this._toItem({key, value})
    const params = {TableName, Item}

    this._db.putItem(params, err => cb(err))
  }

  _del(key, options, cb) {
    const TableName = this._table.name
    const Key = this._toItem({key})
    const params = {TableName, Key}

    this._db.deleteItem(params, err => cb(err))
  }

  _iterator(options) {
    return new DynamoIterator(this, options)
  }

  _batch(array, options, cb) {
    const TableName = this._table.name

    const ops = array.map(({type, key, value}) => (
      type === "del"
        ? {DeleteRequest: {Key: this._toItem({key})}}
        : {PutRequest: {Item: this._toItem({key, value})}}
    ))

    const params = {RequestItems: {}}

    const loop = (err) => {
      if (err) return cb(err)

      const reqs = ops.splice(0, 25)

      if (reqs.length === 0) return cb()

      params.RequestItems[TableName] = reqs

      this._db.batchWriteItem(params, loop)
    }

    loop()
  }
}

export default db => location => new DynamoDOWN(db, location)
