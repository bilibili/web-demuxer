<h4 align="right"><strong>English</strong> | <a href="https://github.com/ForeverSc/web-demuxer/blob/main/README_CN.md">简体中文</a></h4>
<h1 align="center">Web-Demuxer</h1>
<p align="center">Demux media files in the browser using WebAssembly, designed for WebCodecs.</p>

<div align="center">
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/v/web-demuxer" alt="version"></a>
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/dm/web-demuxer" alt="downloads"></a>
  <a href="https://www.jsdelivr.com/package/npm/web-demuxer"><img src="https://data.jsdelivr.com/v1/package/npm/web-demuxer/badge" alt="hits"></a>
</div>

## Overview

WebCodecs provides decoding capabilities but lacks demuxing functionality. While mp4box.js is excellent for MP4 files, it only supports MP4 format. **Web-Demuxer** aims to support a wide range of multimedia formats in one package, specifically designed for seamless WebCodecs integration.

## Features

- 🪄 **WebCodecs-First Design** - API optimized for WebCodecs development with intuitive methods
- 📦 **Multi-Format Support** - Handle mov/mp4/mkv/webm/flv/m4v/wmv/avi/ts and more formats
- 🧩 **Customizable Build** - Configure and build demuxers for specific formats only
- 🔧 **Rich Media Info** - Extract detailed metadata similar to ffprobe output

## Quick Start

```bash
npm install web-demuxer
```

```typescript
import { WebDemuxer } from "web-demuxer";

const demuxer = new WebDemuxer();

// Example: Get video frame at specific time
async function seek(file, time) {
  // 1. Load video file
  await demuxer.load(file);

  // 2. Demux video file and generate VideoDecoderConfig and EncodedVideoChunk required by WebCodecs
  const videoDecoderConfig = await demuxer.getDecoderConfig('video');
  const videoEncodedChunk = await demuxer.seek('video', time);

  // 3. Decode video frame through WebCodecs
  const decoder = new VideoDecoder({
    output: (frame) => {
      // Render frame, e.g., using canvas drawImage
      frame.close();
    },
    error: (e) => {
      console.error('video decoder error:', e);
    }
  });

  decoder.configure(videoDecoderConfig);
  decoder.decode(videoEncodedChunk);
  decoder.flush();
}
```

## Installation

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

### WASM File Setup

**‼️ Important:** Place the WASM file in your static directory (e.g., `public/`) for proper loading.

```typescript
const demuxer = new WebDemuxer({
  // Option 1: Use CDN
  wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
  
  // Option 2: Use local file
  // Copy dist/wasm-files/web-demuxer.wasm from npm package to public directory
  // You can use plugins like vite-plugin-static-copy to sync automatically
  // If JS and WASM are in the same public directory, wasmFilePath can be omitted
  // wasmFilePath: "/path/to/your/public/web-demuxer.wasm"
});
```

## Live Examples
- [Seek Video Frame](https://foreversc.github.io/web-demuxer/#example-seek) | [Source Code](https://github.com/bilibili/web-demuxer/blob/main/index.html#L131-L157)
- [Play Video](https://foreversc.github.io/web-demuxer/#example-play) | [Source Code](https://github.com/bilibili/web-demuxer/blob/main/index.html#L159-L197)

## API

### Constructor

#### `new WebDemuxer(options?: WebDemuxerOptions)`

Creates a new WebDemuxer instance.

**Parameters:**
- `options.wasmFilePath` (optional): Custom WASM file path. Defaults to looking for `web-demuxer.wasm` in the script directory.

### Core Methods

#### `load(source: File | string): Promise<void>`

Loads a media file and initializes the WASM worker.

**Parameters:**
- `source`: File object or URL string

**Note:** All subsequent methods require successful `load()` execution.

#### `getDecoderConfig<T extends MediaType>(type: T): Promise<MediaTypeToConfig[T]>`

Gets WebCodecs decoder configuration.

**Parameters:**
- `type`: `'video'` or `'audio'`

**Returns:** `VideoDecoderConfig` or `AudioDecoderConfig`

#### `seek<T extends MediaType>(type: T, time: number, seekFlag?: AVSeekFlag): Promise<MediaTypeToChunk[T]>`

Seeks to specific time and returns encoded chunk.

**Parameters:**
- `type`: `'video'` or `'audio'`
- `time`: Time in seconds
- `seekFlag`: Seek direction (default: backward)

**Returns:** `EncodedVideoChunk` or `EncodedAudioChunk`

#### `read<T extends MediaType>(type: T, start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<MediaTypeToChunk[T]>`

Creates a stream of encoded chunks.

**Parameters:**
- `type`: `'video'` or `'audio'`
- `start`: Start time in seconds (default: 0)
- `end`: End time in seconds (default: end of file)
- `seekFlag`: Seek direction (default: backward)

**Returns:** `ReadableStream` of encoded chunks

### Media Information

#### `getMediaInfo(): Promise<WebMediaInfo>`

Extracts comprehensive media metadata (similar to ffprobe output).

**Returns:**

<details>
<summary>📋 Example Response (Click to expand)</summary>

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
            "extradata": "Uint8Array",
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
            "extradata": "Uint8Array",
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
</details>

#### `getMediaStream(type: MediaType, streamIndex?: number): Promise<WebAVStream>`

Gets information about a specific media stream.

**Parameters:**
- `type`: `'video'`, `'audio'` or `'subtitle'`
- `streamIndex`: Stream index (optional)

### Low-Level Packet Access

#### `seekMediaPacket(type: MediaType, time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`

Gets raw media packet at specific time.

**Parameters:**
- `type`: Media type (`'video'`, `'audio'` or `'subtitle'`)
- `time`: Time in seconds
- `seekFlag`: Seek direction (default: backward seek)

#### `readMediaPacket(type: MediaType, start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`

Returns a `ReadableStream` for streaming raw media packet data.

**Parameters:**
- `type`: Media type (`'video'`, `'audio'` or `'subtitle'`)
- `start`: Start time in seconds (default: 0)
- `end`: End time in seconds (default: 0, read till end)
- `seekFlag`: Seek direction (default: backward seek)

### Utility Methods

#### `setLogLevel(level: AVLogLevel): void`

Sets logging verbosity level for debugging purposes.

**Parameters:**
- `level`: Log level (see `AVLogLevel` for available options)

#### `destroy(): void`

Cleans up resources and terminates worker.

## Custom Demuxer

Web-Demuxer provides two pre-built versions:

| Version | Size (gzipped) | Supported Formats |
|---------|----------------|-------------------|
| **Full** (`web-demuxer.wasm`) | 1131 kB | mov, mp4, avi, flv, mkv, webm, mpeg, asf, mpegts, etc. |
| **Mini** (`web-demuxer-mini.wasm`) | 493 kB | mov, mp4, mkv, webm, m4v |


### Building Custom Version

For specific format support, customize the build:

1. **Configure formats** in `Makefile`:
```makefile
DEMUX_ARGS = \
    --enable-demuxer=mov,mp4,m4a,3gp,3g2,mj2
```

2. **Start Docker environment**:
```bash
# For ARM64 (Apple Silicon)
npm run dev:docker:arm64

# For x86_64 (Intel/AMD)
npm run dev:docker:x86_64
```

3. **Build custom WASM**:
```bash
npm run build:wasm
```

## License

This project is licensed under the MIT License for the main codebase.  
The `lib/` directory contains FFmpeg-derived code under the LGPL License.
