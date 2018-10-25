var AWS = require('aws-sdk');

var http = require('http');   

var uuidV4 = require('uuid/v4');

AWS.config.region = 'us-east-1';

//get reference to SNS
var sns = new AWS.SNS();

// get reference to S3 client 
var s3 = new AWS.S3();

//get reference to Rekognition client
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

//get reference to DynamoDB client
var docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    
    //Configuration - Start
    var srcBucket = 'detect-face-for-ad';
    var managerPhoneNumber = "+19999999999";
    var table = "demographic";
    //Configuration - End
 
    var srcKey = decodeURIComponent(event.filename.replace(/\+/g, " "));
    var params = {
      Image: {
       S3Object: {
        Bucket: srcBucket, 
        Name: srcKey
       }
      }, 
      Attributes: ["ALL"]
     };
     rekognition.detectFaces(params, function(err, result) {
        if (err) {
            console.log(err, err.stack);
            callback('could not detect faces');
            return;
        }
        else { 
            if (result !== null) {
                console.log(JSON.stringify(result));
                var id = uuidV4(); //generate a UUID number
                var paramsDB = {
                    TableName:table,
                    Item:{
                        "id": id,
                        "info": result //raw response from detectFaces call
                    }
                };
                //save detectFaces response to database for future analytics reporting
                docClient.put(paramsDB, function(err, rs) {
                if (err) {
                    console.log(err, err.stack);
                    callback('could not add to db');
                    return;
                } else {
                    if (result.FaceDetails !== null && result.FaceDetails.length > 0) { 
                            var item = result.FaceDetails[0];
                            if (item !== null && item.Confidence >= 80) {
                                if (item.Emotions !== null && item.Emotions.length > 0) {
                                    var pe = item.Emotions[0]; //most pre-dominant emotion - emotions array is reverse sorted by confidence
                                    if (pe.Confidence > 80 && (pe.Type.toLowerCase() == 'angry' || pe.Type.toLowerCase()  == 'sad' || pe.Type.toLowerCase()  == 'confused' || pe.Type.toLowerCase()  == 'disgusted') && item.AgeRange.Low > 15) {
                                        //contact store manager by sending a text message
                                        //generate tinyurl
                                        var url  = 'http://tinyurl.com/api-create.php?url=https://s3.amazonaws.com/' + srcBucket + '/' + srcKey;
                                        http.get(url, function(res) {
                                            var body = '';
                                            res.on('data', function(data){
                                                body += data;
                                            });
                                            res.on('end', function() {
                                                var shortenedurl = body;
                                                var paramsmessage = {
                                                        Message: 'customer: ' + pe.Type.toLowerCase() + ', gender: ' + item.Gender.Value.toLowerCase() + ', age range: ' + item.AgeRange.Low  + '-' + item.AgeRange.High + ',' + ' picture: ' + shortenedurl,
                                                        MessageStructure: 'string',
                                                        PhoneNumber: managerPhoneNumber
                                                    };
                                                sns.publish(paramsmessage, function(err, data) {
                                                    if (err) {
                                                        console.log(err, err.stack);
                                                        callback('could not send text');
                                                        return;
                                                    }
                                                    else  {
                                                        //fallback ad
                                                        callback(null,'yogadvd.jpg');
                                                        return;
                                                    }      
                                                });    
                                            });
                                        }).on('error', function(e) {
                                            callback('error occured');
                                            return;
                                        });
                                    } else { 
                                        if (item.AgeRange.High <= 15) {
                                            //kid
                                            callback (null, 'gameconsole.jpg');
                                            return;
                                        } else {
                                            if (item.Gender.Confidence > 80) {
                                                if (item.Gender.Value == 'Female') {
                                                    //female
                                                    callback(null, 'lipstick.jpg');
                                                    return;
                                                } else {
                                                    //male
                                                    if ((item.Mustache.Confidence > 80 && item.Mustache.Value === true )||(item.Beard.Confidence > 80 && item.Beard.Value === true)) {
                                                        //male - with beard or mustache
                                                        callback(null, 'beardoil.jpg');
                                                        return;
                                                    } else {
                                                        //male - clean shaven
                                                        callback(null, 'safetyrazor.jpg');
                                                        return;
                                                    }
                                                }
                                            } else {
                                                //gender agnostic ad
                                                callback(null,'tv.jpg');
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });        
            }
        }
    });
}
/*
detectFaces API Call Response:

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
                {
                    "Confidence": 93.29251861572266,
                    "Type": "HAPPY"
                },
                {
                    "Confidence": 28.57428741455078,
                    "Type": "CALM"
                },
                {
                    "Confidence": 1.4989674091339111,
                    "Type": "ANGRY"
                }
            ],
            "Eyeglasses": {
                "Confidence": 99.99998474121094,
                "Value": true
            },
            "EyesOpen": {
                "Confidence": 96.2729721069336,
                "Value": true
            },
            "Gender": {
                "Confidence": 100,
                "Value": "Female"
            },
            "Landmarks": [
                {
                    "Type": "eyeLeft",
                    "X": 0.23941855132579803,
                    "Y": 0.2918034493923187
                },
                {
                    "Type": "eyeRight",
                    "X": 0.3292391300201416,
                    "Y": 0.27594369649887085
                },
                {
                    "Type": "nose",
                    "X": 0.29817715287208557,
                    "Y": 0.3470197319984436
                },
                {
                    "Type": "mouthLeft",
                    "X": 0.24296623468399048,
                    "Y": 0.4368993043899536
                },
                {
                    "Type": "mouthRight",
                    "X": 0.32943305373191833,
                    "Y": 0.42591965198516846
                },
                {
                    "Type": "leftPupil",
                    "X": 0.22671067714691162,
                    "Y": 0.2922942042350769
                },
                {
                    "Type": "rightPupil",
                    "X": 0.33662110567092896,
                    "Y": 0.27894988656044006
                },
                {
                    "Type": "leftEyeBrowLeft",
                    "X": 0.20183917880058289,
                    "Y": 0.23734253644943237
                },
                {
                    "Type": "leftEyeBrowRight",
                    "X": 0.23179863393306732,
                    "Y": 0.22572354972362518
                },
                {
                    "Type": "leftEyeBrowUp",
                    "X": 0.2627321183681488,
                    "Y": 0.23605677485466003
                },
                {
                    "Type": "rightEyeBrowLeft",
                    "X": 0.302413672208786,
                    "Y": 0.23874962329864502
                },
                {
                    "Type": "rightEyeBrowRight",
                    "X": 0.3316373825073242,
                    "Y": 0.222014918923378
                },
                {
                    "Type": "rightEyeBrowUp",
                    "X": 0.36112451553344727,
                    "Y": 0.22867321968078613
                },
                {
                    "Type": "leftEyeLeft",
                    "X": 0.22193069756031036,
                    "Y": 0.2959446609020233
                },
                {
                    "Type": "leftEyeRight",
                    "X": 0.2576832175254822,
                    "Y": 0.2886323630809784
                },
                {
                    "Type": "leftEyeUp",
                    "X": 0.23798644542694092,
                    "Y": 0.28594088554382324
                },
                {
                    "Type": "leftEyeDown",
                    "X": 0.2404623031616211,
                    "Y": 0.29718098044395447
                },
                {
                    "Type": "rightEyeLeft",
                    "X": 0.3105366826057434,
                    "Y": 0.2787334620952606
                },
                {
                    "Type": "rightEyeRight",
                    "X": 0.3483607769012451,
                    "Y": 0.27373066544532776
                },
                {
                    "Type": "rightEyeUp",
                    "X": 0.3284870386123657,
                    "Y": 0.27036795020103455
                },
                {
                    "Type": "rightEyeDown",
                    "X": 0.32978174090385437,
                    "Y": 0.2812310755252838
                },
                {
                    "Type": "noseLeft",
                    "X": 0.27560219168663025,
                    "Y": 0.37984371185302734
                },
                {
                    "Type": "noseRight",
                    "X": 0.31087660789489746,
                    "Y": 0.37326300144195557
                },
                {
                    "Type": "mouthUp",
                    "X": 0.2924160361289978,
                    "Y": 0.407451868057251
                },
                {
                    "Type": "mouthDown",
                    "X": 0.29673251509666443,
                    "Y": 0.46654582023620605
                }
            ],
            "MouthOpen": {
                "Confidence": 72.5211181640625,
                "Value": true
            },
            "Mustache": {
                "Confidence": 77.63107299804688,
                "Value": false
            },
            "Pose": {
                "Pitch": 8.250975608825684,
                "Roll": -8.29802131652832,
                "Yaw": 14.244261741638184
            },
            "Quality": {
                "Brightness": 46.14684295654297,
                "Sharpness": 99.9945297241211
            },
            "Smile": {
                "Confidence": 99.47274780273438,
                "Value": true
            },
            "Sunglasses": {
                "Confidence": 97.63555145263672,
                "Value": true
            }
        }
    ]
}
*/