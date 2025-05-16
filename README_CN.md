<h4 align="right"><a href="https://github.com/ForeverSc/web-demuxer/blob/main/README.md">English</a> | <strong>简体中文</strong></h4>
<h1 align="center">Web-Demuxer</h1>
<p align="center">使用WebAssembly在浏览器中对媒体文件进行解封装, 专门为WebCodecs设计</p>
<div align="center">
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/v/web-demuxer" alt="version"></a>
  <a href="https://www.npmjs.com/package/web-demuxer"><img src="https://img.shields.io/npm/dm/web-demuxer" alt="downloads"></a>
  <a href="https://www.jsdelivr.com/package/npm/web-demuxer"><img src="https://data.jsdelivr.com/v1/package/npm/web-demuxer/badge" alt="hits"></a>
</div>

## 目的
WebCodecs只提供了decode的能力，但没有提供demux的能力。有一些JS解封装mp4box.js很酷，但它只支持mp4，Web-Demuxer的目的是一次性支持更多媒体格式

## 特征
- 🪄 专门为WebCodecs设计，API对于WebCodecs开发而言十分友好，可以轻松实现媒体文件的解封装
- 📦 一次性支持多种媒体格式，比如mov/mp4/mkv/webm/flv/m4v/wmv/avi/ts等等
- 🧩 支持自定义打包，可以调整配置，打包出指定格式的demuxer

## 安装
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

## 使用
```typescript
import { WebDemuxer } from "web-demuxer"

const demuxer = new WebDemuxer({
  // ⚠️ 你需要将npm包中dist/wasm-files文件放到类似public的静态目录下
  // 并确保wasm-files中的js和wasm文件在同一目录下
  wasmLoaderPath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/ffmpeg.min.js",
})

// 以获取指定时间点的视频帧为例
async function seek(file, time) {
  // 1. 加载视频文件
  await demuxer.load(file);

  // 2. 解封装视频文件并生成WebCodecs所需的VideoDecoderConfig和EncodedVideoChunk
  const videoDecoderConfig = await demuxer.getVideoDecoderConfig();
  const videoChunk = await demuxer.seekEncodedVideoChunk(time);

  // 3. 通过WebCodecs去解码视频帧
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

## 样例
- [Seek Video Frame](https://foreversc.github.io/web-demuxer/#example-seek) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L96)
- [Play Video](https://foreversc.github.io/web-demuxer/#example-play) ｜ [code](https://github.com/ForeverSc/web-demuxer/blob/main/index.html#L123)

## API
```typescript
new WebDemuxer(options: WebDemuxerOptions)
```
创建一个新的`WebDemuxer`实例

参数:
- `options`: 必填, 配置选项
  - `wasmLoaderPath`: 必填，wasm对应的js loader文件地址（对应npm包中`dist/wasm-files/ffmpeg.js`或`dist/wasm-files/ffmpeg-mini.js`）
  > ⚠️ 你需要确保将wasm 和js loader文件放在同一个可访问目录下，js loader会默认去请求同目录下的wasm文件

```typescript
load(source: File | string): Promise<void>
```
加载文件并等待wasm worker加载完成。需要等待load方法执行成功后，才可以继续调用后续的方法

参数:
  - `source`: 必填，需要处理的`File`对象或者文件URL 

```typescript
getVideoDecoderConfig(): Promise<VideoDecoderConfig>
```
解析视频流，获取文件的`VideoDecoderConfig`, 返回值可直接作为`VideoDecoder`的`configure`方法的入参  


```typescript
getAudioDecoderConfig(): Promise<AudioDecoderConfig>
```
解析音频流，获取文件的`AudioDecoderConfig`, 返回值可直接作为`AudioDecoder`的`configure`方法的入参

```typescript
seekEncodedVideoChunk(time: number, seekFlag?: AVSeekFlag): Promise<EncodedVideoChunk>
```
根据传入时间点，获取指定时间点的视频数据（默认取关键帧），返回值可直接作为`VideoDecoder`的`decode`方法的入参

参数:
- `time`: 必填，单位为s
- `seekFlag`: 寻址标志, 默认值为1 (向后寻址). 详情请查看 `AVSeekFlag`。

```typescript
seekEncodedAudioChunk(time: number, seekFlag?: AVSeekFlag): Promise<EncodedAudioChunk>
```
根据传入时间点，获取指定时间点的音频数据，返回值可直接作为`AudioDecoder`的`decode`方法的入参

参数:
- `time`: 必填，单位为s
- `seekFlag`: 寻址标志, 默认值为1 (向后寻址). 详情请查看 `AVSeekFlag`。

```typescript
readAVPacket(start?: number, end?: number, streamType?: AVMediaType, streamIndex?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>
```
返回一个`ReadableStream`, 用于流式读取packet数据

参数:
- `start`: 读取开始时间点，单位为s，默认值为0，从头开始读取packet
- `end`: 读取结束时间点，单位为s, 默认值为0，读取到文件末尾
- `streamType`: 媒体流类型，默认值为0, 即视频流，1为音频流。其他具体见`AVMediaType`
- `streamIndex`: 媒体流索引，默认值为-1，即自动选择
- `seekFlag`: 寻址标志, 默认值为1 (向后寻址). 详情请查看 `AVSeekFlag`。

基于`readAVPacket`的语义简化方法:
- `readVideoPacket(start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`
- `readAudioPacket(start?: number, end?: number, seekFlag?: AVSeekFlag): ReadableStream<WebAVPacket>`

```typescript
getAVStream(streamType?: AVMediaType, streamIndex?: number): Promise<WebAVStream>
```
获取媒体文件中指定stream的信息

参数: 
- `streamType`: 媒体流类型，默认值为0, 即视频流，1为音频流。其他具体见`AVMediaType`
- `streamIndex`: 媒体流索引，默认值为-1，即自动选择

基于`getAVStream`的语义简化方法:
- `getVideoStream(streamIndex?: number): Promise<WebAVStream>`
- `getAudioStream(streamIndex?: number): Promise<WebAVStream>`

```typescript
getAVStreams(): Promise<WebAVStream[]>
```
获取媒体文件中所有的stream

```typescript
getAVPacket(time: number, streamType?: AVMediaType, streamIndex?: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>
```
获取媒体文件中指定时间点的数据

参数:
- `time`: 必填，单位为s
- `streamType`: 媒体流类型，默认值为0, 即视频流，1为音频流。其他具体见`AVMediaType`
- `streamIndex`: 媒体流索引，默认值为-1，即自动选择
- `seekFlag`: 寻址标志, 默认值为1 (向后寻址). 详情请查看 `AVSeekFlag`。

基于`getAVPacket`的语义简化方法:
- `seekVideoPacket(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`
- `seekAudioPacket(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket>`

```typescript
getAVPackets(time: number, seekFlag?: AVSeekFlag): Promise<WebAVPacket[]>
```
同时获取某个时间点，所有stream上的packet数据, 并按照stream数组顺序返回

参数:
- `time`: 必填，单位为s
- `seekFlag`: 寻址标志, 默认值为1 (向后寻址). 详情请查看 `AVSeekFlag`。

```typescript
getMediaInfo(): Promise<WebMediaInfo> // 2.0新增
```
获取文件的媒体信息, 输出结果参考自`ffprobe`
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
setLogLevel(level: AVLogLevel) // 2.0新增
```
参数:
- `level`: 必填，输出日志等级, 详见`AVLogLevel`

```typescript
destroy(): void
```
销毁实例，释放worker

## 自定义Demuxer
目前默认提供两个版本的demuxer, 用于支持不同的格式:
- `dist/wasm-files/ffmpeg.js`: 完整版(gzip: 996 kB), 体积较大，支持mov,mp4,m4a,3gp,3g2,mj2,avi,flv,matroska,webm,m4v,mpeg,asf,mpegts
- `dist/wasm-files/ffmpeg-mini.js`: 精简版本(gzip: 456 kB)，体积小，仅支持mov,mp4,m4a,3gp,3g2,matroska,webm,m4v
> 如果你想使用体积更小的版本，可以使用1.0版本的web-demuxer，精简版本仅115KB  
> 1.0版本使用C编写，聚焦WebCodecs，体积小，2.0版本使用C++ Embind，提供了更丰富的媒体信息输出，更易维护，体积大

你也可以通过自定义配置，实现指定格式的demxuer：

首先，修改`Makefile`中的`enable-demuxer`配置
```makefile
DEMUX_ARGS = \
	--enable-demuxer=mov,mp4,m4a,3gp,3g2,mj2,avi,flv,matroska,webm,m4v,mpeg,asf
```
然后先执行`npm run dev:docker:arm64`（如果是windows, 请执行`npm run dev:docker:x86_64`），启动docker环境。   

最后，执行`npm run build:wasm`，构建指定格式的demxuer

## License
本项目主要采用 MIT 许可证覆盖大部分代码。  
`lib/` 目录包含源自 FFmpeg 的代码，遵循 LGPL 许可证。
