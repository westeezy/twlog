/*
Facade for twitter
*/
var Twitter = require('twitter'),
  Promise = require('bluebird');

function twitter(credentials) {
  this.client = new Twitter({
    consumer_key: credentials.consumer_key,
    consumer_secret: credentials.consumer_secret,
    access_token_key: credentials.access_token_key,
    access_token_secret: credentials.access_token_secret
  });
}

/**
 * @param message
 * @return {Promise}
 */
twitter.prototype.simpleTweet = function (message) {
  var that = this;

  return new Promise(function (resolve, reject) {
    that.client.post('statuses/update', {
      status: message
    }, function (error, tweet) {
      if (error) {
        return reject(error);
      }
      resolve(tweet);
    });
  });
};


exports = module.exports = twitter;