dynamodown
==========

A DynamoDB implementation of leveldown.

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
