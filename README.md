dynamo-down
===========

[![Build Status](https://travis-ci.org/jed/dynamo-down.svg?branch=master)](https://travis-ci.org/jed/dynamo-down)

A [DynamoDB][] implementation of [leveldown][] for [io.js][].

This library uses [abstract-leveldown][] to turn a subsection of a DynamoDB table into a leveldown-compatible store for use with [levelup][].

Because the architecture of DynamoDB does not allow for sorted table scans, dynamo-down is implemented using table queries on a given hash key. This means that one DynamoDB table can host many levelup stores, but cannot iterate across them.

Keep in mind that there are some differences between LevelDB and DynamoDB. For example, unlike LevelDB, DynamoDB does not guarantee batch write atomicity, and does not snapshot reads.

Installation
------------

    npm install dynamo-down

Example
-------

```javascript
var aws = require("aws-sdk")
var DynamoDOWN = require("dynamo-down")
var levelup = require("levelup")

var dynamo = new aws.DynamoDB({region: "us-east-1"})
var dynamoDown = DynamoDOWN(dynamo)
var options = {db: dynamoDown, valueEncoding: "json"}
var db = levelup("my-table/nyc-js-meetups", options)

db.put("queens_js"       , {name: "QueensJS"    })
db.put("jerseyscriptusa" , {name: "JerseyScript"})
db.put("manhattan_js"    , {name: "ManhattanJS" })
db.put("brooklyn_js"     , {name: "BrooklynJS"  })

db.createReadStream().on("data", console.log)

// { key: 'brooklyn_js', value: { name: 'BrooklynJS' } }
// { key: 'jerseyscriptusa', value: { name: 'JerseyScript' } }
// { key: 'manhattan_js', value: { name: 'ManhattanJS' } }
// { key: 'queens_js', value: { name: 'QueensJS' } }
```

API
---

### dynamoDown = DynamoDOWN(new aws.DynamoDB)

`DynamoDOWN` takes a DynamoDB instance created using the [aws-sdk][] library, and returns a leveldown-compatible constructor.

### db = levelup("table-name/hash-name", {db: dynamoDown})

When instantiating a levelup store, the location passed as the first argument represents the name of the DynamoDB table and the hash key within the table, separated by a `/`. The table must already exist, and have a schema with both hash and range keys.

### dynamoDown.destroy("table-name/hash-name", cb)

This function leaves the backing DynamoDB table in place, but deletes all items with the specified hash name.

[aws-sdk]: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/
[abstract-leveldown]: https://github.com/rvagg/abstract-leveldown
[levelup]: https://github.com/rvagg/node-levelup
[DynamoDB]: http://aws.amazon.com/dynamodb/
[leveldown]: https://github.com/rvagg/node-leveldown/
[io.js]: https://iojs.org
