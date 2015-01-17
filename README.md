# twlog

[![Build Status](https://travis-ci.org/westeezy/twlog.svg?branch=master)](https://travis-ci.org/westeezy/twlog)
[![Coverage Status](https://coveralls.io/repos/westeezy/twlog/badge.svg?branch=master)](https://coveralls.io/r/westeezy/twlog?branch=master)

HTTP/s logger middleware for node.js that will log your errors to Twitter with a google shortened url via an anonymous Github Gist.

### Getting Started

Twwlog takes two parameters `format` and `options`. A lot of aspects you will find similar to morgan (which was my inspiration for this).

`format` will be a string from a predefined list or a user created one containing the proper tokens.

`options` will hold the Twitter signin data and other goodies. If it is not provided errors will not be logged to Twitter.


#### Options

##### twitter
```js
{
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.access_token_key,
  access_token_secret: process.env.access_token_secret
}
```
##### skip

Function to determine if logging is skipped. This function
will be called as `skip(req, res)`.

```js
twlog(':method :url', {
  skip: function (req, res) { return res.statusCode < 400 }
})
```

##### stream

Output stream for writing log lines, defaults to `process.stdout`.

#### Predefined Formats

There are various pre-defined formats provided:

##### combined

Standard Apache combined log output.

```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

##### common

Standard Apache common log output.

```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]
```

#### Tokens

##### :date[format]

The current date and time in UTC. The available formats are:

  - `clf` for the common log format (`"10/Oct/2000:13:55:36 +0000"`)
  - `iso` for the common ISO 8601 date time format (`2000-10-10T13:55:36.000Z`)
  - `web` for the common RFC 1123 date time format (`Tue, 10 Oct 2000 13:55:36 GMT`)

If no format is given, then the default is `web`.

##### :http-version

The HTTP version of the request.

##### :method

The HTTP version of the request.

##### :referrer

The Referrer header of the request. This will use the standard mis-spelled Referer header if exists, otherwise Referrer.

##### :remote-addr

The remote address of the request. This will use `req.ip`, otherwise the standard `req.connection.remoteAddress` value (socket address).

##### :remote-user

The user authenticated as part of Basic auth for the request.

##### :req[header]

The given `header` of the request.

##### :res[header]

The given `header` of the response.

##### :response-time

The time between the request coming into `twlog` and when the response headers are written, in milliseconds.

##### :status

The status code of the response.

##### :url

The URL of the request. This will use `req.originalUrl` if exists, otherwise `req.url`.

##### :user-agent

The contents of the User-Agent header of the request.


### write logs to a file

Simple app that will log all request in the Apache combined format to the file "access.log"

```js
var express = require('express')
var fs = require('fs')
var twlog = require('twlog')

var app = express()

// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})

// setup the logger
app.use(twlog('combined', {stream: accessLogStream}))

app.get('/', function (req, res) {
  res.send('hello, world!')
})
```

## License

[MIT](LICENSE)
