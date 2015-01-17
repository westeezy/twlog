var assert = require('assert');
var http = require('http');
var twlog = require('..');
var request = require('supertest');
var Twitter = require('twitter');
var nock = require('nock');
var sinon = require('sinon');

var lastLogLine;

function saveLastLogLine(line) {
  lastLogLine = line;
}

describe('twlog()', function () {
  describe('arguments', function () {
    it('should use default format', function (done) {
      request(createServer())
        .get('/')
        .end(function (err, res) {
          if (err) {
            return done(err, res);
          }
          assert(res.text.length > 0);
          assert.equal(lastLogLine.substr(0, res.text.length), res.text);
          done();
        });
    });

    describe('format', function () {
      it('should accept format as format string', function (done) {
        request(createServer(':method :url'))
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, 'GET /\n');
            done();
          });
      });

      it('should reject format as bool', function () {
        assert.throws(createServer.bind(null, true), /Format/);
      });

    });
  });

  describe('tokens', function () {
    describe(':date', function () {
      it('should get current date in "web" format by default', function (done) {
        var server = createServer(':date');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(/^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/m.test(lastLogLine));
            done();
          });
      });

      it('should get current date in "clf" format', function (done) {
        var server = createServer(':date[clf]');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(/^\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} \+|\-\d{4}$/m.test(lastLogLine));
            done();
          });
      });

      it('should get current date in "iso" format', function (done) {
        var server = createServer(':date[iso]');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/m.test(lastLogLine));
            done();
          });
      });

      it('should get current date in "web" format', function (done) {
        var server = createServer(':date[web]');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert(/^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/m.test(lastLogLine));
            done();
          });
      });

    });

    describe(':req', function () {
      it('should get request properties', function (done) {
        var server = createServer(':request[x-from-string]');

        request(server)
          .get('/')
          .set('x-from-string', 'me')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, 'me\n');
            done();
          });
      });
    });

    describe(':res', function () {
      it('should get response properties', function (done) {
        var server = createServer(':response[x-sent]');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, 'true\n');
            done();
          });
      });
    });

    describe(':remoteAddr', function () {
      it('should get remote address', function (done) {
        var server = createServer(':remoteAddr');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, res.text + '\n');
            done();
          });
      });

      it('should use req.ip if there', function (done) {
        var server = createServer(':remoteAddr', null, null, function (req) {
          req.ip = '10.0.0.1';
        });

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, '10.0.0.1\n');
            done();
          });
      });

      it('should work on https server', function (done) {
        var fs = require('fs'),
          https = require('https'),
          cert = fs.readFileSync(__dirname + '/fixtures/twlog.cert', 'ascii'),
          logger = createLogger(':remoteAddr'),
          server = https.createServer({
            key: fs.readFileSync(__dirname + '/fixtures/twlog.key', 'ascii'),
            cert: cert
          });

        server.on('request', function (req, res) {
          logger(req, res, function (err) {
            delete req._remoteAddress;
            res.end(req.connection.remoteAddress);
          });
        });

        var agent = new https.Agent({
            ca: cert
          }),
          createConnection = agent.createConnection;

        agent.createConnection = function (options) {
          options.servername = 'twlog.local';
          return createConnection.call(this, options);
        };

        var req = request(server).get('/');
        req.agent(agent);
        req.end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(lastLogLine, res.text + '\n');
          done();
        });
      });

      it('should work when connection: close', function (done) {
        var server = createServer(':remoteAddr');

        request(server)
          .get('/')
          .set('Connection', 'close')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, res.text + '\n');
            done();
          });
      });

      it('should work when connection: keep-alive', function (done) {
        var server = createServer(':remoteAddr', null, function (req, res, next) {
          delete req._remoteAddress;
          next();
        });

        request(server.listen())
          .get('/')
          .set('Connection', 'keep-alive')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, res.text + '\n');
            res.req.connection.destroy();
            server.close(done);
          });
      });

      it('should work when req.ip is a getter', function (done) {
        var server = createServer(':remoteAddr', null, null, function (req) {
          Object.defineProperty(req, 'ip', {
            get: function () {
              return req.connection.remoteAddress ? '10.0.0.1' : undefined;
            }
          });
        });

        request(server)
          .get('/')
          .set('Connection', 'close')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, '10.0.0.1\n');
            done();
          });
      });

      it('should not fail if req.connection missing', function (done) {
        var server = createServer(':remoteAddr', null, null, function (req) {
          delete req.connection;
        });

        request(server.listen())
          .get('/')
          .set('Connection', 'keep-alive')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, res.text + '\n');
            res.req.connection.destroy();
            server.close(done);
          });
      });
    });


    describe(':remoteUser', function () {
      it('should be empty if none present', function (done) {
        var server = createServer(':remoteUser');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, '-\n');
            done();
          });
      });

      it('should support Basic authorization', function (done) {
        var server = createServer(':remoteUser');

        request(server)
          .get('/')
          .set('Authorization', 'Basic dGo6')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, 'tj\n');
            done();
          });
      });

      it('should be empty for empty Basic authorization user', function (done) {
        var server = createServer(':remoteUser');

        request(server)
          .get('/')
          .set('Authorization', 'Basic Og==')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, '-\n');
            done();
          });
      });
    });

    describe(':responseTime', function () {
      it('should be in milliseconds', function (done) {
        var start = Date.now(),
          server = createServer(':responseTime');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            var end = Date.now();
            var ms = parseFloat(lastLogLine);
            assert(ms > 0);
            assert(ms < end - start + 1);
            done();
          });
      });

      it('should be empty without hidden property', function (done) {
        var server = createServer(':responseTime', null, function (req, res, next) {
          delete req._startAt;
          next();
        });

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, '-\n');
            done();
          });
      });
    });

    describe(':status', function () {
      it('should get response status', function (done) {
        var server = createServer(':status');

        request(server)
          .get('/')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(lastLogLine, res.statusCode + '\n');
            done();
          });
      });

      it('should not exist for aborted request', function (done) {
        var stream = {
            write: writeLog
          },
          server = createServer(':status', {
            stream: stream
          }, function () {
            test.abort();
          });

        function writeLog(log) {
          assert.equal(log, '-\n');
          server.close();
          done();
        }

        var test = request(server).post('/');
        test.write('0');
      });
    });
  });

  describe('formats', function () {
    describe('combined', function () {
      it('should match expectations', function (done) {
        var server = createServer('combined');

        request(server)
          .get('/')
          .set('Authorization', 'Basic dGo6')
          .set('Referer', 'http://localhost/')
          .set('User-Agent', 'my-ua')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            var line = lastLogLine.replace(/\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} \+0000/, '_timestamp_');
            assert.equal(line, res.text + ' - tj [_timestamp_] "GET / HTTP/1.1" 200 - "http://localhost/" "my-ua"\n');
            done();
          });
      });
    });

    describe('common', function () {
      it('should match expectations', function (done) {
        var server = createServer('common');

        request(server)
          .get('/')
          .set('Authorization', 'Basic dGo6')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            var line = lastLogLine.replace(/\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} \+0000/, '_timestamp_');
            assert.equal(line, res.text + ' - tj [_timestamp_] "GET / HTTP/1.1" 200 -\n');
            done();
          });
      });
    });

    describe('default', function () {
      it('should match expectations', function (done) {
        var server = createServer('default');

        request(server)
          .get('/')
          .set('Authorization', 'Basic dGo6')
          .set('Referer', 'http://localhost/')
          .set('User-Agent', 'my-ua')
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            var line = lastLogLine.replace(/\w+, \d+ \w+ \d+ \d+:\d+:\d+ \w+/, '_timestamp_');
            assert.equal(line, res.text + ' - tj [_timestamp_] "GET / HTTP/1.1" 200 - "http://localhost/" "my-ua"\n');
            done();
          });
      });
    });
  });


  describe('with buffer option', function () {
    it('should flush log periodically', function (done) {
      var count = 0,
        server = createServer(':method :url', {
          buffer: true,
          stream: {
            write: writeLog
          }
        });

      function writeLog(log) {
        assert.equal(log, 'GET /first\nGET /second\n');
        server.close();
        done();
      }

      server = server.listen();
      request(server)
        .get('/first')
        .end(function (err, res) {
          if (err) {
            throw err;
          }
          count++;
          request(server)
            .get('/second')
            .end(function (err, res) {
              if (err) {
                throw err;
              }
              count++;
            });
        });
    });

    it('should accept custom interval', function (done) {
      var count = 0,
        server = createServer(':method :url', {
          buffer: 200,
          stream: {
            write: writeLog
          }
        });

      function writeLog(log) {
        assert.equal(log, 'GET /first\nGET /second\n');
        server.close();
        done();
      }

      server = server.listen();
      request(server)
        .get('/first')
        .end(function (err, res) {
          if (err) {
            throw err;
          }
          count++;
          request(server)
            .get('/second')
            .end(function (err, res) {
              if (err) {
                throw err;
              }
              count++;
            });
        });
    });
  });

  describe('with skip option', function () {
    it('should be able to skip based on request', function (done) {
      function skip(req) {
        return~ req.url.indexOf('skip=true');
      }

      var server = createServer('default', {
        'skip': skip
      });

      request(server)
        .get('/?skip=true')
        .set('Connection', 'close')
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(lastLogLine === null);
          done();
        });
    });

    it('should be able to skip based on response', function (done) {
      function skip(req, res) {
        return res.statusCode === 200;
      }

      var server = createServer('default', {
        'skip': skip
      });

      request(server)
        .get('/')
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(lastLogLine === null);
          done();
        });
    });
  });

  describe('on error', function () {
    var sandbox;
    beforeEach(function () {
      sandbox = sinon.sandbox.create();

      nock('https://api.github.com/')
        .post('/gists')
        .reply(200, {
          'html_url': 'www.github.com/gist/1'
        });

      nock('https://www.googleapis.com/')
        .post('/urlshortener/v1/url')
        .reply(200, {
          "kind": "urlshortener#url",
          "id": "http://goo.gl/fbsS",
          "longUrl": "http://www.google.com/"
        });

      nock('https://api.twitter.com/')
        .post('/1.1/statuses/update.json')
        .reply(200, 'http://goo.gl/fbsS');
    });

    afterEach(function () {
      sandbox.restore();
    });

    it("should accept the onError handler", function (done) {
      var stub = sandbox.stub(Twitter.prototype, 'post', function (path, payload) {
        assert(path === 'statuses/update');
        assert(payload.status.indexOf('http://goo.gl/fbsS') > 0);
        done();
      });
      var server = createServer('default', {
        'twitter': {}
      }, null, function (req, res) {
        res.statusCode = 500; //create an error
      });

      request(server)
        .get('/')
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
        });
    });

    it("should accept the errorHeading option", function (done) {
      var stub = sinon.stub(Twitter.prototype, 'post', function (path, payload) {
        assert(path === 'statuses/update');
        assert(payload.status === 'test123 http://goo.gl/fbsS');
        done();
      });
      var server = createServer('default', {
        'twitter': {},
        'errorHeading': 'test123 '
      }, null, function (req, res) {
        res.statusCode = 500; //create an error
      });

      request(server)
        .get('/')
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
        });
    });
  });
});

function createLogger(format, opts) {
  var args = Array.prototype.slice.call(arguments),
    i = Number(typeof args[0] !== 'object'),
    options = args[i] || {};

  if (typeof options === 'object' && !options.stream) {
    options.stream = {
      'write': saveLastLogLine
    };
    lastLogLine = null;
    args[i] = options;
  }

  return twlog.apply(null, args);
}

function createServer(format, opts, fn, fn1) {
  var logger = createLogger(format, opts),
    middle = fn || noopMiddleware;
  return http.createServer(function onRequest(req, res) {
    // prior alterations
    if (fn1) {
      fn1(req, res);
    }
    logger(req, res, function onNext(err) {
      // allow req, res alterations
      middle(req, res, function onDone() {
        if (err) {
          res.statusCode = 500;
          res.end(err.message);
        }

        res.setHeader('X-Sent', 'true');
        res.end((req.connection && req.connection.remoteAddress) || '-');
      });
    });
  });
}

function noopMiddleware(req, res, next) {
  next();
}