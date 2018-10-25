//1. get the file name of the picture from event object
//2. detectFaces in the picture using amazon rekognition
//3. crop each face in the picture using the face boundaries from response of step #2
//4. for each cropped face image, using amazon rekognition searchFacesByImage - save the FaceIds, ExternalImageIds
//5. return the FaceIds, ExternalImageIds

var AWS = require('aws-sdk');

var async = require('async');

var gm = require('gm')
    .subClass({ imageMagick: true }); // Enable ImageMagick integration.

AWS.config.region = 'us-east-1';

// get reference to S3 client 
var s3 = new AWS.S3();

//get reference to Rekognition client
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

exports.handler = function (event, context, callback) {
    if (!event.filename) { 
        callback("filename not specified");
        return;
    }
    
    var srcBucket = 'face-search';
    var srcKey = decodeURIComponent(event.filename.replace(/\+/g, " "));    
    
    //array to hold the result
    var matchIds = [];
    
    // detect faces param
    var paramsDetect = {
      Image: {
       S3Object: {
        Bucket: srcBucket, 
        Name: srcKey
       }
      }, 
      Attributes: ["ALL"]
     };
     rekognition.detectFaces(paramsDetect, function(err, response) {
        if (err) {
            console.log(err, err.stack); 
            callback("Could not detect faces");
            return;
        }
        console.log(JSON.stringify(response));
        var faceBoundaries = response.FaceDetails.map( x => x.BoundingBox);
        var paramsS3 = { Bucket: srcBucket, Key: srcKey };
        s3.getObject(paramsS3, function (err, data) {
            if (err) {
                console.log(err, err.stack); 
                callback("Could not read image in s3: " + srcBucket + "/" + srcKey);
                return;
            }
            gm(data.Body).size(function (err, size){
                if (err) { 
                    console.log(err, err.stack);
                    callback("Could not get image size");
                    return;
                }
                async.each(faceBoundaries, function(item, callbk) {
                    async.waterfall([
                        function cropImage(next) {
                            var width = size.width;
                            var height = size.height;
                            var X = Math.round(item.Left * width);
                            if (X < 0) X = 0;
                            var Y = Math.round(item.Top * height);
                            if (Y < 0) Y = 0;
                            var W = Math.round(item.Width * width);
                            if (W > width) W = width;
                            var H = Math.round(item.Height * height);
                            if (H > height) H = height;
                            console.log("X:" + X + ", Y:" + Y + ", W:" + W + ", H:" + H);
                            gm(data.Body)
                                .crop(W, H, X, Y)
                                .toBuffer('JPG',function (err, buffer) {
                                if (err) {
                                    console.log("Could not crop image");
                                    next(err);
                                } else {
                                    next(null, buffer); 
                                }
                            });
                        },
                        function searchFaces(buffer, next) {
                            var paramsSearch = {
                                CollectionId: "friendsfamily", 
                                FaceMatchThreshold: 70, 
                                Image: {
                                    Bytes: buffer
                                }, 
                                MaxFaces: 25
                            };
                            rekognition.searchFacesByImage(paramsSearch, function(err, data) {
                                if (err) {
                                    console.log("Could not search faces by image");
                                    if (!buffer) console.log('empty buffer');
                                    next(err);
                                } else {
                                    next(null, data);
                                }
                            });
                        }
                    ], function(err, result) {
                        if (err) {
                            console.log(err, err.stack);
                        } else {
                            console.log(JSON.stringify(result));
                            if (result != null && result.FaceMatches != null) {                                   
                                var faces = result.FaceMatches.map(x => x.Face);
                                faces.forEach(function (item) {
                                    matchIds.push({
                                        'FaceId':item.FaceId,
                                        'ExternalImageId':item.ExternalImageId
                                    });
                                });
                            } 
                        }
                        callbk();  
                    });
                }, function(err) {
                    if (err) {
                        console.log(err, err.stack);
                        callback("Could not complete operation");
                        return;
                    } else {
                        var matches = {
                                IDs: matchIds
                        };
                        console.log(JSON.stringify(matches));
                        callback(null, matches); 
                        return;
                    }
                });
            });           
        });
    });
}
/*
detectFaces API Response:
{
    "FaceDetails": [
        {
            "AgeRange": {
                "High": 38,
                "Low": 23
            },
            "Beard": {
                "Confidence": 97.11119842529297,
                "Value": false
            },
            "BoundingBox": {
                "Height": 0.42500001192092896,
                "Left": 0.1433333307504654,
                "Top": 0.11666666716337204,
                "Width": 0.2822222113609314
            },
            "Confidence": 99.8899917602539,
            "Emotions": [
                {.....
     
*/
/*
searchFacesByImage API Response:
{
   ...
    "FaceMatches": [
        {
            "Similarity": 100.0,
            "Face": {
                "BoundingBox": {
                    "Width": 0.6154,
                    "Top": 0.2442,
                    "Left": 0.1765,
                    "Height": 0.4692
                },
                "FaceId": "84de1c86-5059-53f2-a432-34ebb704615d",
                "Confidence": 99.9997,
                "ImageId": "d38ebf91-1a11-58fc-ba42-f978b3f32f60",
                "ExternalImageId":"adam.jpg"
            }
        },
        {
            "Similarity": 84.6859,
            "Face": {
                "BoundingBox": {
                    "Width": 0.2044,
                    "Top": 0.2254,
                    "Left": 0.4622,
                    "Height": 0.3119
                },
                "FaceId": "6fc892c7-5739-50da-a0d7-80cc92c0ba54",
                "Confidence": 99.9981,
                "ImageId": "5d913eaf-cf7f-5e09-8c8f-cb1bdea8e6aa",
                "ExternalImageId":"joel.jpg"
            }
        }
    ]
}
*/