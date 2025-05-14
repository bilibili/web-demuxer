<h4 align="right"><strong>English</strong> | <a href="https://github.com/ForeverSc/web-demuxer/blob/main/README_CN.md">简体中文</a></h4>
<h1 align="center">Web-Demuxer</h1>
<p align="center">Demux media files in the browser using WebAssembly, designed for WebCodecs.</p>
<div align="center">
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/v/web-demuxer" alt="version"></a>
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/dm/web-demuxer" alt="downloads"></a>
  <a href="https://www.jsdelivr.com/package/npm/web-demuxer"><img src="https://data.jsdelivr.com/v1/package/npm/web-demuxer/badge" alt="hits"></a>
</div>

## Purpose
WebCodecs only provide the ability to decode, but not to demux. mp4box.js is cool, but it only supports mp4 demux. Web-Demuxer aims to support as many multimedia formats as possible at once.

## Features
- 🪄 Specifically designed for WebCodecs, the API is very friendly for WebCodecs development, you can easily realize the media file demux.
- 📦 One-time support for a variety of media formats, such as mov/mp4/mkv/webm/flv/m4v/wmv/avi, etc.
- 🧩 Support for customized packaging, you can adjust the configuration, packaged in a specified format demuxer

## Install
### NPM
```bash
npm install web-demuxer
```

### CDN
```html
<script type="module">
  import { WebDemuxer } from 'https://cdn.jsdelivr.net/npm/web-demuxer/+esm';
</script>
```

## Usage
```typescript
import { WebDemuxer } from "web-demuxer"

const demuxer = new WebDemuxer({
  // ⚠️ you need to put the dist/wasm-files file in the npm package into a static directory like public
  // making sure that the js and wasm in wasm-files are in the same directory
  wasmLoaderPath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/ffmpeg.min.js",
})

// Take the example of seeking a video frame at a specified point in time
async function seek(file, time) {
  // 1. load video file
  await demuxer.load(file);

  // 2. demux video file and generate WebCodecs needed VideoDecoderConfig and EncodedVideoChunk
  const videoDecoderConfig = await demuxer.getVideoDecoderConfig();
  const videoChunk = await demuxer.seekEncodedVideoChunk(time);

  // 3. use WebCodecs to decode frame
  const decoder = new VideoDecoder({
    output: (frame) => {
      // draw frame...
      frame.close();
    },
    error: (e) => {
      console.error('video decoder error:', e);
    }
  });

  decoder.configure(videoDecoderConfig);
  decoder.decode(videoChunk);
  decoder.flush();
}
```

## Examples
- [Seek Video Frame](https://foreversc.github.io/web-demuxer/#example-seek) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L96)
- [Play Video](https://foreversc.github.io/web-demuxer/#example-play) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L123)

## API
```typescript
new WebDemuxer(options: WebDemuxerOptions)
```
Creates a new instance of `WebDemuxer`.

Parameters:
- `options`: Required, configuration options.
  - `wasmLoaderPath`: Required, the path to the corresponding JavaScript loader file for wasm (corresponding to the `ffmpeg.js` or `ffmpeg-mini.js` in the `dist/wasm-files` directory of the npm package).
  > ⚠️ You must ensure that the wasm and JavaScript loader files are placed in the same accessible directory, the JavaScript loader will default to requesting the wasm file in the same directory.

```typescript
load(source: File | string): Promise<void>
```
Loads a file and waits for the wasm worker to finish loading. The subsequent methods can only be called after the `load` method has been successfully executed.

Parameters:
  - `source`: Required, support the `File` object or file URL to be processed.

```typescript
getVideoDecoderConfig(): Promise<VideoDecoderConfig>
```
Parses the video stream to obtain the `VideoDecoderConfig` of the file, and the return value can be directly used as an argument for the `configure` method of `VideoDecoder`.

```typescript
getAudioDecoderConfig(): Promise<AudioDecoderConfig>
```
Parses the audio stream to obtain the `AudioDecoderConfig` of the file, and the return value can be directly used as an argument for the `configure` method of `AudioDecoder`.

```typescript
seekEncodedVideoChunk(time: number, seekFlag?: AVSeekFlag): Promise<EncodedVideoChunk>
```
Retrieves the video data at the specified time point (default keyframe), and the return value can be directly used as an argument for the `decode` method of `VideoDecoder`.

Parameters:
- `time`: Required, in seconds.
- `seekFlag`: The seek flag, defaults to 1 (seek backward). See `AVSeekFlag` for more details.

```typescript
seekEncodedAudioChunk(time: number, seekFlag?: AVSeekFlag): Promise<EncodedAudioChunk>
```
Retrieves the audio data at the specified time point, and the return value can be directly used as an argument for the `decode` method of `AudioDecoder`.

Parameters:
- `time`: Required, in seconds.
- `seekFlag`: The seek flag, defaults to 1 (seek backward). See `AVSeekFlag` for more details.

```typescript
readAVPacket(start?: number, end?: number, streamType?: AVMediaType, streamIndex?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>
```
Returns a `ReadableStream` for streaming packet data.

Parameters:
- `start`: The start time for reading, in seconds, defaults to 0, reading packets from the beginning.
- `end`: The end time for reading, in seconds, defaults to 0, reading until the end of the file.
- `streamType`: The type of media stream, defaults to 0, which is the video stream. 1 is audio stream. See `AVMediaType` for more details.
- `streamIndex`: The index of the media stream, defaults to -1, which is to automatically select.
- `seekFlag`: The seek flag, defaults to 1 (seek backward). See `AVSeekFlag` for more details.

Simplified methods based on the semantics of `readAVPacket`:
- `readVideoPacket(start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`
- `readAudioPacket(start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`

```typescript
getAVStream(streamType?: AVMediaType, streamIndex?: number): Promise<WebAVStream>
```
Gets information about a specified stream in the media file.

Parameters:
- `streamType`: The type of media stream, defaults to 0, which is the video stream. 1 is audio stream. See `AVMediaType` for more details.
- `streamIndex`: The index of the media stream, defaults to -1, which is to automatically select.

Simplified methods based on the semantics of `getAVStream`:
- `getVideoStream(streamIndex?: number): Promise<WebAVStream>`
- `getAudioStream(streamIndex?: number): Promise<WebAVStream>`

```typescript
getAVStreams(): Promise<WebAVStream[]>
```
Get all streams in the media file.

```typescript
getAVPacket(time: number, streamType?: AVMediaType, streamIndex?: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>
```
Gets the data at a specified time point in the media file.

Parameters:
- `time`: Required, in seconds.
- `streamType`: The type of media stream, defaults to 0, which is the video stream. 1 is audio stream. See `AVMediaType` for more details.
- `streamIndex`: The index of the media stream, defaults to -1, which is to automatically select.
- `seekFlag`: The seek flag, defaults to 1 (seek backward). See `AVSeekFlag` for more details.

Simplified methods based on the semantics of `getAVPacket`:
- `seekVideoPacket(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`
- `seekAudioPacket(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`

```typescript
getAVPackets(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket[]>
```
Simultaneously retrieves packet data on all streams at a certain time point and returns in the order of the stream array.

Parameters:
- `time`: Required, in seconds.
- `seekFlag`: The seek flag, defaults to 1 (seek backward). See `AVSeekFlag` for more details.

```typescript
getMediaInfo(): Promise<WebMediaInfo> // 2.0 New
```
Get the media information of a file, the output is referenced from `ffprobe`
```json
{
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": 263.383946,
    "bit_rate": "6515500",
    "start_time": 0,
    "nb_streams": 2,
    "streams": [
        {
            "id": 1,
            "index": 0,
            "codec_type": 0,
            "codec_type_string": "video",
            "codec_name": "h264",
            "codec_string": "avc1.640032",
            "color_primaries": "bt2020",
            "color_range": "tv",
            "color_space": "bt2020nc",
            "color_transfer": "arib-std-b67",
            "profile": "High",
            "pix_fmt": "yuv420p",
            "level": 50,
            "width": 1080,
            "height": 2336,
            "channels": 0,
            "sample_rate": 0,
            "sample_fmt": "u8",
            "bit_rate": "6385079",
            "extradata_size": 36,
            "extradata": Uint8Array,
            "r_frame_rate": "30/1",
            "avg_frame_rate": "30/1",
            "sample_aspect_ratio": "N/A",
            "display_aspect_ratio": "N/A",
            "start_time": 0,
            "duration": 263.33333333333337,
            "rotation": 0,
            "nb_frames": "7900",
            "tags": {
                "creation_time": "2023-12-10T15:50:56.000000Z",
                "language": "und",
                "handler_name": "VideoHandler",
                "vendor_id": "[0][0][0][0]"
            }
        },
        {
            "id": 2,
            "index": 1,
            "codec_type": 1,
            "codec_type_string": "audio",
            "codec_name": "aac",
            "codec_string": "mp4a.40.2",
            "profile": "",
            "pix_fmt": "",
            "level": -99,
            "width": 0,
            "height": 0,
            "channels": 2,
            "sample_rate": 44100,
            "sample_fmt": "",
            "bit_rate": "124878",
            "extradata_size": 2,
            "extradata": Uint8Array,
            "r_frame_rate": "0/0",
            "avg_frame_rate": "0/0",
            "sample_aspect_ratio": "N/A",
            "display_aspect_ratio": "N/A",
            "start_time": 0,
            "duration": 263.3839455782313,
            "rotation": 0,
            "nb_frames": "11343",
            "tags": {
                "creation_time": "2023-12-10T15:50:56.000000Z",
                "language": "und",
                "handler_name": "SoundHandler",
                "vendor_id": "[0][0][0][0]"
            }
        }
    ]
}
```

```typescript
setLogLevel(level: AVLogLevel) // 2.0 New
```
Parameters:
- `level`: Required, output log level, see `AVLogLevel` for details.

```typescript
destroy(): void
```
Destroys the instance and releases the worker.

## Custom Demuxer
Currently, two versions of the demuxer are provided by default to support different formats:
- `dist/wasm-files/ffmpeg.js`: Full version (gzip: 996 kB), larger in size, supports mov, mp4, m4a, 3gp, 3g2, mj2, avi, flv, matroska, webm, m4v, mpeg, asf
- `dist/wasm-files/ffmpeg-mini.js`: Minimalist version (gzip: 456 kB), smaller in size, only supports mov, mp4, m4a, 3gp, 3g2, matroska, webm, m4v
> If you want to use a smaller size version, you can use version 1.0 of web-demuxer, the lite version is only 115KB  
> Version 1.0 is written in C, focuses on WebCodecs, and is small in size, while version 2.0 uses C++ Embind, which provides richer media information output, is easier to maintain, and is large in size

You can also implement a demuxer for specific formats through custom configuration:

First, modify the `enable-demuxer` configuration in the `Makefile`
```makefile
DEMUX_ARGS = \
    --enable-demuxer=mov,mp4,m4a,3gp,3g2,mj2,avi,flv,matroska,webm,m4v,mpeg,asf
```
Then execute `npm run dev:docker:arm64` (if on Windows, please execute `npm run dev:docker:x86_64`) to start the Docker environment.

Finally, execute `npm run build:wasm` to build the demuxer for the specified formats.

## License
This project is primarily licensed under the MIT License, covering most of the codebase.  
The `lib/` directory includes code derived from FFmpeg, which is licensed under the LGPL License.
