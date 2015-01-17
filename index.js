var debug = require('debug')('twlog'),
  onFinished = require('on-finished'),
  auth = require('basic-auth'),
  dateFormat = require('dateformat'),
  Googl = require('goo.gl'),
  Twitter = require('./lib/twitter'),
  Gist = require('./lib/gist');

var defaultBufferDuration = 1000,
  formats = {
    combined: ':remoteAddr - :remoteUser [:date[clf]] ":method :url HTTP/:httpVersion" :status :response[content-length] ":referrer" ":userAgent"',
    common: ':remoteAddr - :remoteUser [:date[clf]] ":method :url HTTP/:httpVersion" :status :response[content-length]',
    default: ':remoteAddr - :remoteUser [:date] ":method :url HTTP/:httpVersion" :status :response[content-length] ":referrer" ":userAgent"'
  },
  parser = {
    method: function (req) {
      return req.method;
    },
    url: function (req) {
      return req.originalUrl || req.url;
    },
    responseTime: function (req, res) {
      if (!res._header || !req._startAt) {
        return '';
      }
      var diff = process.hrtime(req._startAt);
      var ms = diff[0] * 1e3 + diff[1] * 1e-6;
      return ms.toFixed(3);
    },
    date: function (req, res, field) {
      var date = new Date();
      switch (field) {
      case 'clf':
        return dateFormat(date, 'dd/mmm/yyyy:HH:MM:ss') + ' +0000';
      case 'iso':
        return date.toISOString();
      case 'web':
      default:
        return date.toUTCString();
      }
    },
    status: function (req, res) {
      return res._header ? res.statusCode : null;
    },
    referrer: function (req) {
      return req.headers.referer || req.headers.referrer;
    },
    remoteAddr: function (req) {
      return getip(req);
    },
    remoteUser: function (req) {
      var creds = auth(req);
      var user = (creds && creds.name) || '-';
      return user;
    },
    httpVersion: function (req) {
      return req.httpVersionMajor + '.' + req.httpVersionMinor;
    },
    userAgent: function (req) {
      return req.headers['user-agent'];
    },
    request: function (req, res, field) {
      return req.headers[field.toLowerCase()];
    },
    response: function (req, res, field) {
      return (res._headers || {})[field.toLowerCase()];
    }
  };

function writeLine(req, res, format) {
  return format.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g, function (prop, match, arg) {
    return parser[match](req, res, arg) || '-';
  });
}

/**
 * Get request IP address.
 *
 * @private
 * @param {IncomingMessage} req
 * @return {String}
 */
function getip(req) {
  return req.ip || req._remoteAddress || (req.connection && req.connection.remoteAddress) || undefined;
}

/**
 * Create a twlogger middleware.
 *
 * @public
 * @param {String|Function} format
 * @param {Object} [options]
 * @return {Function} middleware
 */
exports = module.exports = function twlog(format, options) {
  if (format && typeof format !== 'string') {
    throw new TypeError('Format must be a string', "twlog");
  }

  options = options || {};
  format = format || formats.default;

  var buffer = options.buffer,
    gist = new Gist(),
    stream = options.stream || process.stdout,
    twitter = {},
    skip = options.skip || function () {
      return false;
    };

  // twitter setup
  if (options.twitter) {
    twitter = new Twitter(options.twitter);
  }
  if (format) {
    format = formats[format] ? formats[format] : format; //allow user string
  }

  if (buffer) {
    var realStream = stream,
      buf = [],
      timer = null,
      interval = 'number' === typeof buffer ? buffer : defaultBufferDuration,
      flush = function () {
        timer = null;

        if (buf.length) {
          realStream.write(buf.join(''));
          buf.length = 0;
        }
      };

    stream = {
      write: function (str) {
        if (timer === null) {
          timer = setTimeout(flush, interval);
        }

        buf.push(str);
      }
    };
  }

  /**
   * Copy error to a Gist and tweet the url
   */
  function onError(error, twitter, gist) {
    gist.create(error, 'Error found in my Application')
      .then(function (resp) {
        var gistUrl = resp.html_url;
        return Googl.shorten(gistUrl);
      })
      .then(function (shortUrl) {
        debug('error posted at shortUrl: ' + shortUrl);
        return twitter.simpleTweet((options.errorHeading || 'I had an error @ ') + shortUrl);
      });
  }


  return function logger(req, res, next) {
    req._startAt = process.hrtime();
    req._startTime = new Date();
    req._remoteAddress = getip(req);

    var responseEnd = res.end;

    // Proxy the real end function
    res.end = function (chunk, encoding) {
      res.end = responseEnd;

      if (res.statusCode > 499) {
        res._chunkedError = chunk;
      }

      res.end(chunk, encoding);
    };

    function logRequest(err, res) {
      if (skip(req, res)) {
        debug('skip request');
        return;
      }

      var line = writeLine(req, res, format);

      if (line === null) {
        debug('skipping line');
        return;
      }

      if (res.statusCode > 499 && options.twitter) {
        onError(res._chunkedError, twitter, gist);
      }

      debug('logging request');
      stream.write(line + '\n');
    }

    onFinished(res, logRequest);
    next();
  };
};