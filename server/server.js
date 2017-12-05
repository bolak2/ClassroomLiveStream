(function() {
  var Bits, StreamServer, config, logger, streamServer, url;

  url = require('url');

  config = require('./config');

  StreamServer = require('./stream_server');

  Bits = require('./bits');

  logger = require('./logger');

  Bits.set_warning_fatal(true);

  logger.setLevel(logger.LEVEL_INFO);

  //Initializing a stream server object, which does more heavy lifting
  streamServer = new StreamServer;

  //Parses the uri received and throws an error if authorization is invalid
  //Right now authorisation is valid by default, and all that happens is that
  //we get the pathname of the rtsp uri and pass it to the variable pathname
  //e.g. file for a file being streamed from the current directory, live for
  //a stream being received from a source
  streamServer.setLivePathConsumer(function(uri, callback) {
    var isAuthorized, pathname;
    pathname = url.parse(uri).pathname.slice(1);
    isAuthorized = true;
    if (isAuthorized) {
      return callback(null);
    } else {
      return callback(new Error('Unauthorized access'));
    }
  });

  //Reads from the configuration file to see if we have a 
  //default directory from which we can stream files, this 
  //calls a callback in streamServer.js, which calls a callback 
  //in avstreams.js, which actually initializes the stream
  if (config.recordedDir != null) {
    streamServer.attachRecordedDir(config.recordedDir);
  }

  //asynchronously handling SIGINT, printing to the console
  //and killing the process with SIGTERM
  process.on('SIGINT', (function(_this) {
    return function() {
      console.log('Got SIGINT');
      return streamServer.stop(function() {
        return process.kill(process.pid, 'SIGTERM');
      });
    };
  })(this));

  //For any other exception, this is the function that 
  //ultimately throws the error.
  process.on('uncaughtException', function(err) {
    streamServer.stop();
    throw err;
  });

  //We start the streamServer class, this results in assigning a port from the config file
  streamServer.start();

}).call(this);
