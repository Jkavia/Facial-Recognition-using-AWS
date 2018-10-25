//dependencies
var AWS = require('aws-sdk');

//get reference to elasticsearch
var elasticsearch = require('elasticsearch');

//get reference to connection handler for Amazon ES
var httpawses = require('http-aws-es');

//get credentials to execute the function
var myCredentials = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials 

//get reference to elastic search client
var es = elasticsearch.Client({
  hosts: 'https://search-travell-yzaqvhqglmjsfximbovj6hilc4.us-east-1.es.amazonaws.com',
  connectionClass: httpawses,
  amazonES: {
    region: 'us-east-1',
    credentials: myCredentials
  }
});

exports.handler = (event, context, callback) => {

es.search({
  index: 'images',
  type: 'labels',
  body: {
    query: {
      match: {
        tags: {
            query: event.search,
            operator: 'or'
        }
      }
    }
  }
},function(err,resp,status) {
    var result = resp.hits.hits.map(x => x._source);
    console.log(JSON.stringify(result));
    callback(null, result);
});
}