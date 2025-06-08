<h4 align="right"><a href="https://github.com/ForeverSc/web-demuxer/blob/main/README.md">English</a> | <strong>简体中文</strong></h4>
<h1 align="center">Web-Demuxer</h1>
<p align="center">使用 WebAssembly 在浏览器中对媒体文件进行解封装，专门为 WebCodecs 设计</p>

<div align="center">
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/v/web-demuxer" alt="version"></a>
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/dm/web-demuxer" alt="downloads"></a>
  <a href="https://www.jsdelivr.com/package/npm/web-demuxer"><img src="https://data.jsdelivr.com/v1/package/npm/web-demuxer/badge" alt="hits"></a>
</div>

## 项目概述

WebCodecs 提供了解码能力但缺乏解封装功能。虽然 mp4box.js 在处理 MP4 文件方面表现优秀，但它只支持 MP4 格式。**Web-Demuxer** 旨在通过一个包支持广泛的多媒体格式，专门为无缝集成 WebCodecs 而设计。

## 核心特性

- 🪄 **WebCodecs 优先设计** - 为 WebCodecs 开发优化的直观 API
- 📦 **多格式支持** - 支持 mov/mp4/mkv/webm/flv/m4v/wmv/avi/ts 等多种格式  
- 🧩 **可定制构建** - 可配置并构建仅支持特定格式的解封装器
- 🔧 **丰富媒体信息** - 提取类似 ffprobe 输出的详细元数据

## 快速开始

```bash
npm install web-demuxer
```

```typescript
import { WebDemuxer } from "web-demuxer";

const demuxer = new WebDemuxer();

// 以获取指定时间点的视频帧为例
async function seek(file, time) {
  // 1. 加载视频文件
  await demuxer.load(file);

  // 2. 解封装视频文件并生成WebCodecs所需的VideoDecoderConfig和EncodedVideoChunk
  const videoDecoderConfig = await demuxer.getDecoderConfig('video');
  const videoEncodedChunk = await demuxer.seek('video', time);

  // 3. 通过WebCodecs去解码视频帧
  const decoder = new VideoDecoder({
    output: (frame) => {
      // 绘制frame，比如使用canvas的drawImage
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

## 安装方式

### NPM 安装
```bash
npm install web-demuxer
```

### CDN 引入
```html
<script type="module">
  import { WebDemuxer } from 'https://cdn.jsdelivr.net/npm/web-demuxer/+esm';
</script>
```

### WASM 文件配置

**‼️ 重要提示：** 请将 WASM 文件放置在静态目录中（如 `public/`）以确保正确加载。

```typescript
const demuxer = new WebDemuxer({
  // 方式1：使用 CDN
  wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
  
  // 方式2：使用本地文件
  // 将npm包中dist/wasm-files/web-demuxer.wasm 复制到 public 目录
  // 可以利用类似vite-plugin-static-copy的复制插件来实现同步
  // 如果JS和WASM在同一个public目录下，wasmFilePath可以不传
  // wasmFilePath: "/path/to/your/public/web-demuxer.wasm"
});
```

## 在线示例
- [获取视频帧](https://foreversc.github.io/web-demuxer/#example-seek) | [源码](https://github.com/bilibili/web-demuxer/blob/main/index.html#L131-L157)
- [播放视频](https://foreversc.github.io/web-demuxer/#example-play) | [源码](https://github.com/bilibili/web-demuxer/blob/main/index.html#L159-L197)

## API

### 构造函数

#### `new WebDemuxer(options?: WebDemuxerOptions)`

创建新的 WebDemuxer 实例。

**参数：**
- `options.wasmFilePath`（可选）：自定义 WASM 文件路径，默认会查找脚本目录下的`web-demuxer.wasm`。

### 核心方法

#### `load(source: File | string): Promise<void>`

加载媒体文件并初始化 WASM worker。

**参数：**
- `source`：File 对象或 URL 字符串

**注意：** 所有后续方法都需要成功执行 `load()` 后才能调用。

#### `getDecoderConfig<T extends MediaType>(type: T): Promise<MediaTypeToConfig[T]>`

获取 WebCodecs 解码器配置。

**参数：**
- `type`：`'video'` 或 `'audio'`

**返回值：** `VideoDecoderConfig` 或 `AudioDecoderConfig`

#### `seek<T extends MediaType>(type: T, time: number, seekFlag?: AVSeekFlag): Promise<MediaTypeToChunk[T]>`

跳转到指定时间并返回编码块。

**参数：**
- `type`：`'video'` 或 `'audio'`
- `time`：时间（秒）
- `seekFlag`：寻址方向（默认：向后）

**返回值：** `EncodedVideoChunk` 或 `EncodedAudioChunk`

#### `read<T extends MediaType>(type: T, start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<MediaTypeToChunk[T]>`

创建编码块流。

**参数：**
- `type`：`'video'` 或 `'audio'`
- `start`：开始时间（秒，默认：0）
- `end`：结束时间（秒，默认：文件末尾）
- `seekFlag`：寻址方向（默认：向后）

**返回值：** 编码块的 `ReadableStream`

### 媒体信息

#### `getMediaInfo(): Promise<WebMediaInfo>`

提取全面的媒体元数据（类似 ffprobe 输出）。

**返回值：** 

<details>
<summary>📋 响应示例（点击展开）</summary>

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

获取特定媒体流的信息。

**参数：**
- `type`：`'video'` 或 `'audio'`
- `streamIndex`：流索引（可选）

### 底层数据包访问

#### `seekMediaPacket(type: MediaType, time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`

获取指定时间的原始媒体数据包。

**参数：**
- `type`：媒体类型（`'video'` 或 `'audio'`）
- `time`：时间（秒）
- `seekFlag`：寻址方向（默认：向后寻址）

#### `readMediaPacket(type: MediaType, start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`

返回用于流式传输原始媒体数据包的 `ReadableStream`。

**参数：**
- `type`：媒体类型（`'video'` 或 `'audio'`）
- `start`：开始时间（秒，默认：0）
- `end`：结束时间（秒，默认：0，读取到文件末尾）
- `seekFlag`：寻址方向（默认：向后寻址）

### 实用方法

#### `setLogLevel(level: AVLogLevel): void`

设置日志详细级别，用于调试目的。

**参数：**
- `level`：日志级别（可用选项详见 `AVLogLevel`）

#### `destroy(): void`

清理资源并终止 worker。

## 自定义构建

Web-Demuxer 提供两个预构建版本：

| 版本 | 大小（gzip 压缩） | 支持格式 |
|------|------------------|----------|
| **完整版** (`web-demuxer.wasm`) | 1131 kB | mov, mp4, avi, flv, mkv, webm, mpeg, asf, mpegts 等 |
| **精简版** (`web-demuxer-mini.wasm`) | 493 kB | mov, mp4, mkv, webm, m4v |


### 构建自定义版本

针对特定格式支持，可自定义构建：

1. **在 `Makefile` 中配置格式**：
```makefile
DEMUX_ARGS = \
    --enable-demuxer=mov,mp4,m4a,3gp,3g2,mj2
```

2. **启动 Docker 环境**：
```bash
# ARM64 架构（Apple Silicon）
npm run dev:docker:arm64

# x86_64 架构（Intel/AMD）
npm run dev:docker:x86_64
```

3. **构建自定义 WASM**：
```bash
npm run build:wasm
```

## 开源协议

本项目主要代码采用 MIT 许可证。  
`lib/` 目录包含源自 FFmpeg 的代码，遵循 LGPL 许可证。
