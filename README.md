# CLASSROOM LIVE STREAMING

## OBJECTIVES:
In our project, we aimed to stream video between Android devices through the use of an intermediate server that used the RTSP
protocol.

## QUICK RUN:
We can start the server with the command
sudo node server.js

The libstreaming app is in branch "Larry", it is called example 3.

The server will then wait for either a client to connect to it, or a client to publish streams to it.(Sudo is not required if we set the port in config.js to above 1023).
We publish streams from an android device using the libstreaming library. Libstreaming takes data from the Android Device's camera and converts it into .H264 and AAC formats for video and audio respectively, which should be recognized by the server.
To stream to the server, set the url to

rtsp://localhost:80/live/STREAM_NAME

where localhost is the ip address of the server.
The server will indicate that it has begun uploading the stream, and the android device will report the bitrate being sent to the server in real time. The android device will be able to pause and resume the stream as well.

We use Android's VideoView to receive the streamed file. In the attached file, before running, we must set the url to
rtsp://localhost:80/live/STREAM_NAME 
The video should now successfully be live streaming from one Android device to another.

Alternatively, if you want to test receiving the streamed file independently of a live source, any .mp4 file in the file/ directory will be available at the url rtsp://localhost:80/file/filename (e.x. rtsp://192.168.1.1:80/file/test.mp4).

## POSSIBLE HICCUPS:
Sometimes Android's VideoView displays a black screen and does not play back the video. 
This is usually because of a firewall that blocks UDP packets.
In this case, the file can still be played back on VLC media player on an Android device (or on any type of device). 
We are certain that play back works with VLC files, because even when the VLC media player does not successfully get the rtsp connection (usually because of a firewall on the ports that the server would like to stream to), it then proceeds to establish an rtsp connection over http, which is supported by our server, and performs quite well.

If it seems as if VideoView is not connecting to the server, you can confirm that the server still works by attempting to connect with the offical VLC app on Android/ VLC media player on any device (we would be happy to demonstrate this to you in person).

We have analysed the rtsp streams published by the server with openRTSP, a command line tool that can be 
used to verify the integrity of rtsp streams, and received successful play requests.

If the libstreaming app fails to connect to the server, it is probably because the ANNOUNCE request was declined. 
Such errors are likely due to subtle differences in format between libstreaming's rtp and h264/aac implementation and node.js' rtp and h264/aac implementation. Nevertheless, libstreaming is presently the best way to stream data to a server from the device

However, you can verify that the server does successfully accept sources by streaming from any ffmpeg source (or openRTSP) with the command
ffmpeg -re -i input.mp4 -c:v libx264 -preset fast -c:a libfdk_aac -ab 128k -ar 44100 -f rtsp rtsp://localhost:80/live/STREAM_NAME

## CODE DESCRIPTION

### NODE RTSP/HTTP SERVER

Our node RTSP/HTTP server relies on several packages:
aac.js
codec_utils.js
logger.js
rtsp.js
stream_server.js
avstreams.js
config.js
h264.js
mp4.js
sdp.js
bits.js
event_emitter.js
http.js
mpegts.js
rtp.js
server.js
We rely on the packages aac.js, h264.js, mp4.js, rtp.js and avstreams.js to maintain representations of streams
in the server and account for the representation of data that is written to and read from sockets in the body of
RTP messages. 
The fundamental units of video are known as NAL(Network Abstraction Layer) units, which basically serve the role of packets for video. The aac access units serve the role of packets for audio, i.e. these are the smallest units written to a socket at a time.
The package sdp.js is used to parse and create messages in session description protocol while communicating between the server and client in the rtsp protocol. The packages bits.js and logger.js allow us to perform operations on individual bits and print debug/usage information to the console. Because of the event/callback-driven nature of node.js code, it is difficult to abstract away low level details, and therefore there are large gaps between comments explaining the intent of our code in rtsp.js, because those all involve the rigorous arithmetic of transporting data over RTP. The files that we modified for our use are server.js, stream_server.js, rtsp.js, and config.js, and these have been commented in crucial places to explain their purpose.
In an RTSP implementation, the SETUP and TEARDOWN requests are necessary. SETUP is necessary before a PLAY request to notify the server of which port it will be receiving on, and the server usually confirms the chosen parameters and also tells the client which port it shall be streaming from.
The ANNOUNCE request involves the client publishing a presentation description(sdp form of all media streams, i.e., providing data about the ports where the data will be served, the protocol used, etc). If all the formats provided are valid, the server can then take a RECORD request where the client specifies the uri it desires, and the server can get the timestamps from which it should play the received data.
RTP streaming involves a sister protocol, RTCP, which provides complementary information about the packets lost in RTP streaming, the bitrate, etc. Both sender and receiver RTCP ports send statistics to each other throughout the duration of the stream, and this information can be used to synchronize the audio and video streams by using timestamps that start from the same date (Jan 1 1900). The end of a session is marked by the BYE message sent by RTCP ports.
Conventionally the RTP ports are even numbered and RTCP ports are contiguous odd numbers. The default ports at which the server listens are specified in config.js.
Our RTSP clients are capable of using TCP instead of UDP if they choose to make rtsp requests over http, in which case they get their RTSP updates through "tunneled GET" and "tunneled POST" requests, as can be seen in our code. As noted before, in the pesky case of a firewall interfering with Android VideoView's working, this allows VLC based apps to connect reliably.

### VIDEOVIEW

The VideoView app uses Android's videoView to stream the uri specified in the function. The uri must be changed to the rtsp uri of the server in the format rtsp://server:port/(file or live)/(name of stream)

### Libstreaming

The libstreaming app creates an RTSPClient that can send audio and video streams to a server. Again, if we specify the uri correctly, the data is delivered and other streaming clients can have the stream forwarded to them by the server.
