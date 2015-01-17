var request = require('request'),
  Promise = require('bluebird');

function Gist() {
  this.api = "https://api.github.com/";
}

/**
 * @param contents
 * @param desc
 * @param cb
 * @return {Promise}
 */
Gist.prototype.create = function (contents, desc) {
  var url = this.api + 'gists',
    body = {
      description: desc,
      files: {
        log: {
          content: contents
        }
      }
    };

  return this._request({
    url: url,
    json: body,
    method: "POST",
    headers: {
      'User-Agent': 'request'
    }
  });
};

/**
 * @param options
 * @param cb
 * @return {Promise}
 */
Gist.prototype._request = function (options) {
  return new Promise(function (resolve, reject) {
    request(options, function (err, res, gist) {
      if (err) {
        return reject(err);
      }
      resolve(gist);
    });
  });
};

exports = module.exports = Gist;