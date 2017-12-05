(function() {
  var Bits, DEBUG_INCOMING_PACKET_DATA, DEBUG_INCOMING_PACKET_HASH, DEFAULT_SERVER_NAME, Sequent, StreamServer, aac, avstreams, config, crypto, fs, h264, http, logger, mp4, net, ref, rtsp, serverName;

  net = require('net');

  fs = require('fs');

  crypto = require('crypto');

  config = require('./config');

  http = require('./http');

  rtsp = require('./rtsp');

  h264 = require('./h264');

  aac = require('./aac');

  mp4 = require('./mp4');

  Bits = require('./bits');

  avstreams = require('./avstreams');

  logger = require('./logger');


  Sequent = require('sequent');

  DEBUG_INCOMING_PACKET_DATA = false;

  DEBUG_INCOMING_PACKET_HASH = false;

  DEFAULT_SERVER_NAME = "node-rtsp-server/";

  serverName = (ref = config.serverName) != null ? ref : DEFAULT_SERVER_NAME;

  //This is the constructor for the StreamServer object
  //The servername and httpHandler objects are initialized
  //The rtspServer object is initialized with a name and a httpHandler after that
  //Finally, the events 'video_start','audio_start','video',and 'audio' are given
  //their callback functions(these are associated with the RTSP server)
  //After that, the function definitions of the callbacks for each event are given
  //Then we register the functions that occur with the events 'new', 'reset', 'end'
  //'audio_start','video_start' (associated with audiostreams, basically initializing, resetting, stopping, starting the audio stream/video stream)
  //The "attach recordedDir and attach mp4" functions go into the the directory specified in config and generate an AVstream by calling AVGenerator
  //from parsing the mp4 file. This part is technical and is implemented by the mp4.js library. Technically all the events associated with streaming
  //are handled by the lower level libraries through the callbacks as you can see here, ending up ultimately calling back avstreams.js, which initializes
  //stream parameters. (avstreams itself initialises the NAL packets for the H264 video and the access units for the AAC audio)
  //The start function assigns a port to the RTSP server, from the port specified in config. We have it set to 80 by default, we can see it was
  //called in server.js
  StreamServer = (function() {
    function StreamServer(opts) {
      var httpHandler, ref1;
      this.serverName = (ref1 = opts != null ? opts.serverName : void 0) != null ? ref1 : serverName;
      if (config.enableHTTP) {
        this.httpHandler = new http.HTTPHandler({
          serverName: this.serverName,
          documentRoot: opts != null ? opts.documentRoot : void 0
        });
      }
      if (config.enableRTSP || config.enableHTTP) {
        if (config.enableHTTP) {
          httpHandler = this.httpHandler;
        } else {
          httpHandler = null;
        }
        this.rtspServer = new rtsp.RTSPServer({
          serverName: this.serverName,
          httpHandler: httpHandler,
        });
        this.rtspServer.on('video_start', (function(_this) {
          return function(stream) {
            return _this.onReceiveVideoControlBuffer(stream);
          };
        })(this));
        this.rtspServer.on('audio_start', (function(_this) {
          return function(stream) {
            return _this.onReceiveAudioControlBuffer(stream);
          };
        })(this));
        this.rtspServer.on('video', (function(_this) {
          return function(stream, nalUnits, pts, dts) {
            return _this.onReceiveVideoNALUnits(stream, nalUnits, pts, dts);
          };
        })(this));
        this.rtspServer.on('audio', (function(_this) {
          return function(stream, accessUnits, pts, dts) {
            return _this.onReceiveAudioAccessUnits(stream, accessUnits, pts, dts);
          };
        })(this));
      }
      avstreams.on('new', function(stream) {
        if (DEBUG_INCOMING_PACKET_HASH) {
          return stream.lastSentVideoTimestamp = 0;
        }
      });
      avstreams.on('reset', function(stream) {
        if (DEBUG_INCOMING_PACKET_HASH) {
          return stream.lastSentVideoTimestamp = 0;
        }
      });
      avstreams.on('end', (function(_this) {
        return function(stream) {
          if (config.enableRTSP) {
            _this.rtspServer.sendEOS(stream);
          }
        };
      })(this));
      avstreams.on('audio_data', (function(_this) {
        return function(stream, data, pts) {
          return _this.onReceiveAudioAccessUnits(stream, [data], pts, pts);
        };
      })(this));
      avstreams.on('video_data', (function(_this) {
        return function(stream, nalUnits, pts, dts) {
          if (dts == null) {
            dts = pts;
          }
          return _this.onReceiveVideoNALUnits(stream, nalUnits, pts, dts);
        };
      })(this));
      avstreams.on('audio_start', (function(_this) {
        return function(stream) {
          return _this.onReceiveAudioControlBuffer(stream);
        };
      })(this));
      avstreams.on('video_start', (function(_this) {
        return function(stream) {
          return _this.onReceiveVideoControlBuffer(stream);
        };
      })(this));
    }

    StreamServer.prototype.attachRecordedDir = function(dir) {
      if (config.recordedApplicationName != null) {
        logger.info("attachRecordedDir: dir=" + dir + " app=" + config.recordedApplicationName);
        return avstreams.attachRecordedDirToApp(dir, config.recordedApplicationName);
      }
    };

    StreamServer.prototype.attachMP4 = function(filename, streamName) {
      var context, generator;
      logger.info("attachMP4: file=" + filename + " stream=" + streamName);
      context = this;
      generator = new avstreams.AVStreamGenerator({
        generate: function() {
          var ascBuf, ascInfo, audioSpecificConfig, bits, err, mp4File, mp4Stream, streamId;
          try {
            mp4File = new mp4.MP4File(filename);
          } catch (error) {
            err = error;
            logger.error("error opening MP4 file " + filename + ": " + err);
            return null;
          }
          streamId = avstreams.createNewStreamId();
          mp4Stream = new avstreams.MP4Stream(streamId);
          logger.info("created stream " + streamId + " from " + filename);
          avstreams.emit('new', mp4Stream);
          avstreams.add(mp4Stream);
          mp4Stream.type = avstreams.STREAM_TYPE_RECORDED;
          audioSpecificConfig = null;
          mp4File.on('audio_data', function(data, pts) {
            return context.onReceiveAudioAccessUnits(mp4Stream, [data], pts, pts);
          });
          mp4File.on('video_data', function(nalUnits, pts, dts) {
            if (dts == null) {
              dts = pts;
            }
            return context.onReceiveVideoNALUnits(mp4Stream, nalUnits, pts, dts);
          });
          mp4File.on('eof', (function(_this) {
            return function() {
              return mp4Stream.emit('end');
            };
          })(this));
          mp4File.parse();
          mp4Stream.updateSPS(mp4File.getSPS());
          mp4Stream.updatePPS(mp4File.getPPS());
          ascBuf = mp4File.getAudioSpecificConfig();
          bits = new Bits(ascBuf);
          ascInfo = aac.readAudioSpecificConfig(bits);
          mp4Stream.updateConfig({
            audioSpecificConfig: ascBuf,
            audioASCInfo: ascInfo,
            audioSampleRate: ascInfo.samplingFrequency,
            audioClockRate: 90000,
            audioChannels: ascInfo.channelConfiguration,
            audioObjectType: ascInfo.audioObjectType
          });
          mp4Stream.durationSeconds = mp4File.getDurationSeconds();
          mp4Stream.lastTagTimestamp = mp4File.getLastTimestamp();
          mp4Stream.mp4File = mp4File;
          mp4File.fillBuffer(function() {
            context.onReceiveAudioControlBuffer(mp4Stream);
            return context.onReceiveVideoControlBuffer(mp4Stream);
          });
          return mp4Stream;
        },
        play: function() {
          return this.mp4File.play();
        },
        pause: function() {
          return this.mp4File.pause();
        },
        resume: function() {
          return this.mp4File.resume();
        },
        seek: function(seekSeconds, callback) {
          var actualStartTime;
          actualStartTime = this.mp4File.seek(seekSeconds);
          return callback(null, actualStartTime);
        },
        sendVideoPacketsSinceLastKeyFrame: function(endSeconds, callback) {
          return this.mp4File.sendVideoPacketsSinceLastKeyFrame(endSeconds, callback);
        },
        teardown: function() {
          this.mp4File.close();
          return this.destroy();
        },
        getCurrentPlayTime: function() {
          return this.mp4File.currentPlayTime;
        },
        isPaused: function() {
          return this.mp4File.isPaused();
        }
      });
      return avstreams.addGenerator(streamName, generator);
    };

    StreamServer.prototype.stop = function(callback) {
      return typeof callback === "function" ? callback() : void 0;
    };

    StreamServer.prototype.start = function(callback) {
      var seq, waitCount;
      seq = new Sequent;
      waitCount = 0;
      if (config.enableRTSP || config.enableHTTP) {
        waitCount++;
        this.rtspServer.start({
          port: config.serverPort
        }, function() {
          return seq.done();
        });
      }
      return seq.wait(waitCount, function() {
        return typeof callback === "function" ? callback() : void 0;
      });
    };

    StreamServer.prototype.setLivePathConsumer = function(func) {
      if (config.enableRTSP) {
        return this.rtspServer.setLivePathConsumer(func);
      }
    };

    StreamServer.prototype.onReceiveVideoControlBuffer = function(stream, buf) {
      stream.resetFrameRate(stream);
      stream.isVideoStarted = true;
      stream.timeAtVideoStart = Date.now();
      return stream.timeAtAudioStart = stream.timeAtVideoStart;
    };

    StreamServer.prototype.onReceiveAudioControlBuffer = function(stream, buf) {
      stream.isAudioStarted = true;
      stream.timeAtAudioStart = Date.now();
      return stream.timeAtVideoStart = stream.timeAtAudioStart;
    };

    StreamServer.prototype.onReceiveVideoDataBuffer = function(stream, buf) {
      var dts, nalUnit, pts;
      pts = buf[1] * 0x010000000000 + buf[2] * 0x0100000000 + buf[3] * 0x01000000 + buf[4] * 0x010000 + buf[5] * 0x0100 + buf[6];
      dts = pts;
      nalUnit = buf.slice(7);
      return this.onReceiveVideoPacket(stream, nalUnit, pts, dts);
    };

    StreamServer.prototype.onReceiveAudioDataBuffer = function(stream, buf) {
      var adtsFrame, dts, pts;
      pts = buf[1] * 0x010000000000 + buf[2] * 0x0100000000 + buf[3] * 0x01000000 + buf[4] * 0x010000 + buf[5] * 0x0100 + buf[6];
      dts = pts;
      adtsFrame = buf.slice(7);
      return this.onReceiveAudioPacket(stream, adtsFrame, pts, dts);
    };

    StreamServer.prototype.onReceiveVideoNALUnits = function(stream, nalUnits, pts, dts) {
      var hasVideoFrame, j, len, md5, nalUnit, nalUnitType, tsDiff;
      if (DEBUG_INCOMING_PACKET_DATA) {
        logger.info("receive video: num_nal_units=" + nalUnits.length + " pts=" + pts);
      }
      if (config.enableRTSP) {
        this.rtspServer.sendVideoData(stream, nalUnits, pts, dts);
      }
      hasVideoFrame = false;
      for (j = 0, len = nalUnits.length; j < len; j++) {
        nalUnit = nalUnits[j];
        nalUnitType = h264.getNALUnitType(nalUnit);
        if (nalUnitType === h264.NAL_UNIT_TYPE_SPS) {
          stream.updateSPS(nalUnit);
        } else if (nalUnitType === h264.NAL_UNIT_TYPE_PPS) {
          stream.updatePPS(nalUnit);
        } else if ((nalUnitType === h264.NAL_UNIT_TYPE_IDR_PICTURE) || (nalUnitType === h264.NAL_UNIT_TYPE_NON_IDR_PICTURE)) {
          hasVideoFrame = true;
        }
        if (DEBUG_INCOMING_PACKET_HASH) {
          md5 = crypto.createHash('md5');
          md5.update(nalUnit);
          tsDiff = pts - stream.lastSentVideoTimestamp;
          logger.info("video: pts=" + pts + " pts_diff=" + tsDiff + " md5=" + (md5.digest('hex').slice(0, 7)) + " nal_unit_type=" + nalUnitType + " bytes=" + nalUnit.length);
          stream.lastSentVideoTimestamp = pts;
        }
      }
      if (hasVideoFrame) {
        stream.calcFrameRate(pts);
      }
    };

    StreamServer.prototype.onReceiveVideoPacket = function(stream, nalUnitGlob, pts, dts) {
      var nalUnits;
      nalUnits = h264.splitIntoNALUnits(nalUnitGlob);
      if (nalUnits.length === 0) {
        return;
      }
      this.onReceiveVideoNALUnits(stream, nalUnits, pts, dts);
    };

    StreamServer.prototype.onReceiveAudioAccessUnits = function(stream, accessUnits, pts, dts) {
      var accessUnit, i, j, len, md5, ptsPerFrame;
      if (config.enableRTSP) {
        this.rtspServer.sendAudioData(stream, accessUnits, pts, dts);
      }
      if (DEBUG_INCOMING_PACKET_DATA) {
        logger.info("receive audio: num_access_units=" + accessUnits.length + " pts=" + pts);
      }
      ptsPerFrame = 90000 / (stream.audioSampleRate / 1024);
      for (i = j = 0, len = accessUnits.length; j < len; i = ++j) {
        accessUnit = accessUnits[i];
        if (DEBUG_INCOMING_PACKET_HASH) {
          md5 = crypto.createHash('md5');
          md5.update(accessUnit);
          logger.info("audio: pts=" + pts + " md5=" + (md5.digest('hex').slice(0, 7)) + " bytes=" + accessUnit.length);
        }
      }
    };

    StreamServer.prototype.onReceiveAudioPacket = function(stream, adtsFrameGlob, pts, dts) {
      var adtsFrame, adtsFrames, adtsInfo, i, isConfigUpdated, j, len, rawDataBlock, rawDataBlocks, rtpTimePerFrame;
      adtsFrames = aac.splitIntoADTSFrames(adtsFrameGlob);
      if (adtsFrames.length === 0) {
        return;
      }
      adtsInfo = aac.parseADTSFrame(adtsFrames[0]);
      isConfigUpdated = false;
      stream.updateConfig({
        audioSampleRate: adtsInfo.sampleRate,
        audioClockRate: adtsInfo.sampleRate,
        audioChannels: adtsInfo.channels,
        audioObjectType: adtsInfo.audioObjectType
      });
      rtpTimePerFrame = 1024;
      rawDataBlocks = [];
      for (i = j = 0, len = adtsFrames.length; j < len; i = ++j) {
        adtsFrame = adtsFrames[i];
        rawDataBlock = adtsFrame.slice(7);
        rawDataBlocks.push(rawDataBlock);
      }
      return this.onReceiveAudioAccessUnits(stream, rawDataBlocks, pts, dts);
    };

    return StreamServer;

  })();

  module.exports = StreamServer;

}).call(this);
