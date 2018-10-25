// dependencies
var AWS = require('aws-sdk');

//get reference to Rekognition client
var rekognition = new AWS.Rekognition({apiVersion: '2016-06-27'});

//get reference to elasticsearch
var elasticsearch = require('elasticsearch');

//get reference to connection handler for Amazon ES
var httpawses = require('http-aws-es');

//get credentials for elastic search client
var myCredentials = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials 

//get reference to elastic search client
var es = elasticsearch.Client({
  hosts: 'search-travel-pkoh4kfkkvp3yth3qyqb7t25eu.us-east-1.es.amazonaws.com',
  connectionClass: httpawses,
  amazonES: {
    region: 'us-east-1',
    credentials: myCredentials
  }
});

exports.handler = (event, context, callback) => {
    
    //get S3 bucket name
    var srcBucket = event.Records[0].s3.bucket.name;
    
    //Object key may have spaces or unicode non-ASCII characters.
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    var params = {
      Image: {
       S3Object: {
        Bucket: srcBucket, 
        Name: srcKey
       }
      }, 
      MaxLabels: 10, 
      MinConfidence: 80
     };

     //get labels from Rekognition service
     rekognition.detectLabels(params, function(err, data) {
        if (err) callback(err); //an error occured
        //prepare the tags array
        var labels = data.Labels.map(x=>x.Name);  

        //insert to elasticsearch index
        es.index({
          index: 'images',
          type: 'labels',
            body: {
              title: 'https://s3.amazonaws.com/' + srcBucket + '/' + srcKey,
              tags: labels
            }
          }, function(err, data) {
              //log the labels to cloudwatch logs
              console.log(JSON.stringify(labels));
              callback(null,'ok');
        });
    });
}