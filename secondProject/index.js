// dependencies
var AWS = require('aws-sdk');

AWS.config.region = 'us-east-1';

//get reference to Rekognition client
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

exports.handler = (event, context, callback) => {

    //get S3 bucket name
    var srcBucket = event.Records[0].s3.bucket.name;

    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    
    var collectionName = "friendsfamily";
    var isCollectionFound = false;  

    var paramsIndexFace = {
      CollectionId: collectionName, 
      DetectionAttributes: [
      ], 
      ExternalImageId: srcKey, 
      Image: {
       S3Object: {
        Bucket: srcBucket, 
        Name: srcKey
       }
      }
    };
 
    //fetch list of Rekognition collections
    var params = {
    };

    rekognition.listCollections(params, function(err, data) {
       if (err) { // an error occurred
            console.log(err, err.stack); 
            callback("Could not list collections");
            return;
        }
        else { // successful response
            if (data.CollectionIds.length > 0) {
               for (var i in data.CollectionIds) {
                   if (data.CollectionIds[i] == collectionName) {
                       isCollectionFound = true;
                       break;
                   }
               }
            } 
            if (!isCollectionFound) {
                // create collection
                var paramsCreate = {
                  CollectionId: collectionName
                };
                rekognition.createCollection(paramsCreate, function(err, dataCreate) {
                    if (err) {
                        console.log(err, err.stack);
                        callback("Could not create collection");
                        return; 
                    } 
                    else {
                            //index faces
                            rekognition.indexFaces(paramsIndexFace, function(err, dataIndex) {
                            if (err) {
                                    console.log(err, err.stack);
                                    callback("Could not index photo");
                                    return; 
                                } 
                            else {
                                    console.log(JSON.stringify(dataIndex));
                                    callback(null,"Created collection & indexed photo - done!");
                                }           
                        });
                    }
                });
            } else {
                    //index faces
                    rekognition.indexFaces(paramsIndexFace, function(err, dataIndex) {
                    if (err) {
                            console.log(err, err.stack);
                            callback("Could not index photo");
                            return; 
                        } 
                    else {
                        console.log(JSON.stringify(dataIndex));
                        callback(null,"Indexed photo - done!");
                    }           
                });
            }   
        } 
    });
}