import url from "url"
import http from "http"
import assert from "assert"
import dynalite from "dynalite"
import async from "async"
import aws from "aws-sdk"
import levelup from "levelup"
import concat from "concat-stream"
import DynamoDOWN from "./dynamo-down"

let server
let dynamo
let db

const httpStatusCodes = Object
  .keys(http.STATUS_CODES)
  .map(key => ({key, value: {message: http.STATUS_CODES[key]}}))

const openDatabase = function(cb) {
  server = dynalite({createTableMs: 0})

  server.listen(function(err) {
    if (err) throw err

    const {address, port} = server.address()
    const endpoint = url.format({
      protocol: "http",
      hostname: address,
      port: port
    })

    dynamo = new aws.DynamoDB({
      endpoint: endpoint,
      region: "us-east-1",
      accessKeyId: "....................",
      secretAccessKey: "........................................"
    })

    cb()
  })
}

const closeDatabase = function(cb) {
  server.close(cb)
}

const createTable = function(cb) {
  const params = {
    TableName: "test",
    KeySchema: [
      {
        "AttributeName": "type",
        "KeyType": "HASH"
      },
      {
        "AttributeName": "key",
        "KeyType": "RANGE"
      },
    ],
    AttributeDefinitions: [
      {
        AttributeName: "type",
        AttributeType: "S"
      },
      {
        AttributeName: "key",
        AttributeType: "S"
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }

  const oncreated = (err) => {
    if (err) throw err

    db = levelup("test/httpStatusCode", {
      db: DynamoDOWN(dynamo)
    })

    setTimeout(cb, 1000)
  }

  dynamo.createTable(params, oncreated)
}

const deleteTable = function(cb) {
  const params = {
    TableName: "test"
  }

  const ondeleted = (err) => {
    if (err) throw err

    setTimeout(cb, 1000)
  }

  dynamo.deleteTable(params, ondeleted)
}

const resetTable = function(cb) {
  async.series([deleteTable, createTable], cb)
}

const write = function(cb) {
  const ws = db.createWriteStream()

  for (let code of httpStatusCodes) ws.write(code)

  ws.end()
  setTimeout(cb, 1000)
}

const read = function(cb) {
  const rs = db.createReadStream({reverse: true})
  const ws = concat(array => {
    assert.deepEqual(array.reverse(), httpStatusCodes)
    cb()
  })

  rs.pipe(ws)
}

async.series([
  openDatabase,
  createTable,
  write,
  read,
  deleteTable,
  closeDatabase
])
