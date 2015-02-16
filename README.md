dynamodown
==========

A DynamoDB implementation of leveldown.

This library uses [abstract-leveldown][] to turn a subsection of a DynamoDB table into a leveldown-compatible store for use with [levelup][].

Because the architecture of DynamoDB does not allow for sorted table scans, dynamodown is implemented using table queries on a given hash key. This means that one DynamoDB table can host many levelup stores, but cannot iterate across them.

Keep in mind that there are some differences between LevelDB and DynamoDB. For example, unlike LevelDB, DynamoDB does not guarantee batch write atomicity, and does not snapshot reads.

Example
-------

```javascript
var aws = require("aws-sdk")
var DynamoDOWN = require("dynamodown")
var levelup = require("levelup")

var dynamo = new aws.DynamoDB({region: "us-east-1"})
var dynamoDown = DynamoDOWN(dynamo)
var db = levelup("mytable/myhash", {db: dynamoDown})

db.put("name", "Yuri Irsenovich Kim")
db.put("dob", "16 February 1941")
db.put("spouse", "Kim Young-sook")
db.put("occupation", "Clown")

db.createReadStream()
   .on("data", function (data) {
      if (typeof data.value !== "undefined") {
         console.log(data.key, "=", data.value)
      }
   })
   .on("error", function (err) {
      console.log("Oh my!", err)
   })
   .on("close", function () {
      console.log("Stream closed")
   })
   .on("end", function () {
     console.log("Stream ended")
   })
```

API
---

### dynamoDown = DynamoDOWN(new aws.DynamoDB)

`DynamoDOWN` takes a DynamoDB instance created using the [aws-sdk][] library, and returns a leveldown-compatible constructor.

### db = levelup("mytable/myhash", {db: dynamoDown})

When instantiating a levelup store, the location passed as the first argument represents the name of the DynamoDB table and the hash key within the table, separated by a `/`. The table must already exist, and have a schema with both hash and range keys.

[aws-sdk]: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/
[abstract-leveldown]: https://github.com/rvagg/abstract-leveldown
[levelup]: https://github.com/rvagg/levelup
