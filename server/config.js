(function() {
  var os;

  os = require('os');

  module.exports = {

    /* Basic configurations */
    serverPort: 80,
    serverName: 'node-rtsp-server',
    videoFrameRate: 30,
    videoBitrateKbps: 2000,
    audioBitrateKbps: 40,

    /* Enable/disable each functions */
    enableRTSP: true,
    enableHTTP: true,
    enableCustomReceiver: true,

    /* RTSP configurations */
    audioRTPServerPort: 7042,
    audioRTCPServerPort: 7043,
    videoRTPServerPort: 7044,
    videoRTCPServerPort: 7045,

    /* RTSP/RTMP configurations */
    liveApplicationName: 'live',
    recordedApplicationName: 'file',
    recordedDir: 'file',

    /* Advanced configurations */
    audioPeriodSize: 1024,
    keepaliveTimeoutMs: 30000,
    rtcpSenderReportIntervalMs: 5000,
    rtspDisableHierarchicalSBR: true,
    dropH264AccessUnitDelimiter: true,
    debug: {
      dropAllData: false
    },
    rtspVideoDataUDPListenPort: 5004,
    rtspVideoControlUDPListenPort: 5005,
    rtspAudioDataUDPListenPort: 5006,
    rtspAudioControlUDPListenPort: 5007
  };

}).call(this);
