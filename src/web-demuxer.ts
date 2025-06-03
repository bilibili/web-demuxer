import {
  AVLogLevel,
  AVMediaType,
  AVSeekFlag,
  WasmWorkerMessageData,
  WasmWorkerMessageType,
  WebAVPacket,
  WebAVStream,
  WebMediaInfo,
} from "./types";
import WasmWorker from "./wasm.worker.ts?worker&inline";

const TIME_BASE = 1e6;

export interface WebDemuxerOptions {
  /**
   * wasm file path
   */
  wasmFilePath: string;
}

/**
 * WebDemuxer
 * 
 * A class to demux media files in the browser using WebAssembly.
 *
 * @example
 * ```typescript
 * const demuxer = new WebDemuxer({ wasmFilePath: '/path/to/web-demuxer.wasm' });
 * await demuxer.load(file);
 * const packet = await demuxer.seekVideoPacket(10); // seek to 10s
 * ```
 */
export class WebDemuxer {
  private wasmWorker: Worker;
  private wasmWorkerLoadStatus: Promise<void>;
  private msgId: number;

  public source?: File | string;

  constructor(options: WebDemuxerOptions) {
    this.wasmWorker = new WasmWorker();
    this.wasmWorkerLoadStatus = new Promise((resolve, reject) => {
      this.wasmWorker.addEventListener("message", (e) => {
        const { type, errMsg } = e.data;

        if (type === WasmWorkerMessageType.WasmWorkerLoaded) {
          this.post(WasmWorkerMessageType.LoadWASM, {
            wasmFilePath: options.wasmFilePath,
          });
        }

        if (type === WasmWorkerMessageType.WASMRuntimeInitialized) {
          resolve();
        }

        if (type === WasmWorkerMessageType.LoadWASM && errMsg) {
          reject(errMsg);
        }
      });
    });

    this.msgId = 0;
  }

  private post(
    type: WasmWorkerMessageType,
    data?: WasmWorkerMessageData,
    msgId?: number,
  ) {
    this.wasmWorker.postMessage({
      type,
      msgId: msgId ?? this.msgId++,
      data,
    });
  }

  private getFromWorker<T>(type: WasmWorkerMessageType, msgData: WasmWorkerMessageData): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.source) {
        reject("source is not loaded. call load() first");
        return;
      }

      const msgId = this.msgId;
      const msgListener = ({ data }: MessageEvent) => {
        if (data.type === type && data.msgId === msgId) {
          if (data.errMsg) {
            reject(data.errMsg);
          } else {
            resolve(data.result);
          }
          this.wasmWorker.removeEventListener("message", msgListener);
        }
      };

      this.wasmWorker.addEventListener("message", msgListener);
      this.post(type, msgData, msgId);
    });
  }

  /**
   * Load a file for demuxing
   * @param source source to load
   * @returns load status
   */
  public async load(source: File | string) {
    await this.wasmWorkerLoadStatus;

    this.source = source;
  }

  /**
   * Destroy the demuxer instance
   * terminate the worker
   */
  public destroy() {
    this.source = undefined;
    this.wasmWorker.terminate();
  }

  // ================ base api ================
  /**
   * Gets information about a specified stream in the media file.
   * @param streamType The type of media stream
   * @param streamIndex The index of the media stream
   * @returns WebAVStream
   */
  public getAVStream(
    streamType = AVMediaType.AVMEDIA_TYPE_VIDEO,
    streamIndex = -1,
  ): Promise<WebAVStream> {
    return this.getFromWorker(WasmWorkerMessageType.GetAVStream, {
      source: this.source!,
      streamType,
      streamIndex,
    });
  }

  /**
   * Get all streams
   * @returns WebAVStream[]
   */
  public getAVStreams(): Promise<WebAVStream[]> {
    return this.getFromWorker(WasmWorkerMessageType.GetAVStreams, {
      source: this.source!,
    });
  }

  /**
   * Get file media info
   * @returns WebMediaInfo
   */
  public getMediaInfo(): Promise<WebMediaInfo> {
    return this.getFromWorker(WasmWorkerMessageType.GetMediaInfo, {
      source: this.source!,
    });
  }

  /**
   * Gets the data at a specified time point in the media file.
   * @param time time in seconds
   * @param streamType The type of media stream
   * @param streamIndex The index of the media stream
   * @param seekFlag The seek flag
   * @returns WebAVPacket
   */
  public getAVPacket(
    time: number,
    streamType = AVMediaType.AVMEDIA_TYPE_VIDEO,
    streamIndex = -1,
    seekFlag = AVSeekFlag.AVSEEK_FLAG_BACKWARD
  ): Promise<WebAVPacket> {
    return this.getFromWorker(WasmWorkerMessageType.GetAVPacket, {
      source: this.source!,
      time,
      streamType,
      streamIndex,
      seekFlag
    });
  }

  /**
   * Get all packets at a time point from all streams
   * @param time time in seconds
   * @param seekFlag The seek flag
   * @returns WebAVPacket[]
   */
  public getAVPackets(
    time: number,
    seekFlag = AVSeekFlag.AVSEEK_FLAG_BACKWARD
  ): Promise<WebAVPacket[]> {
    return this.getFromWorker(WasmWorkerMessageType.GetAVPackets, {
      source: this.source!,
      time,
      seekFlag
    });
  }

  /**
   * Returns a `ReadableStream` for streaming packet data.
   * @param start start time in seconds
   * @param end end time in seconds
   * @param streamType The type of media stream
   * @param streamIndex The index of the media stream
   * @param seekFlag The seek flag
   * @returns ReadableStream<WebAVPacket>
   */
  public readAVPacket(
    start = 0,
    end = 0,
    streamType = AVMediaType.AVMEDIA_TYPE_VIDEO,
    streamIndex = -1,
    seekFlag = AVSeekFlag.AVSEEK_FLAG_BACKWARD
  ): ReadableStream<WebAVPacket> {
    const queueingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });
    const msgId = this.msgId;
    let pullCounter = 0;
    let msgListener: (e: MessageEvent) => void;
    let cancelResolver: () => void;

    return new ReadableStream(
      {
        start: (controller) => {
          if (!this.source) {
            controller.error("source is not loaded. call load() first");
            return;
          }
          msgListener = (e: MessageEvent) => {
            const data = e.data;

            if (
              data.type === WasmWorkerMessageType.ReadAVPacket &&
              data.msgId === msgId
            ) {
              if (data.errMsg) {
                controller.error(data.errMsg);
                this.wasmWorker.removeEventListener("message", msgListener);
              } else {
                // noop
              }
            }

            if (
              data.type === WasmWorkerMessageType.AVPacketStream &&
              data.msgId === msgId
            ) {
              if (data.result && !cancelResolver) {
                controller.enqueue(data.result);
              } else {
                this.wasmWorker.removeEventListener("message", msgListener);
                // only close if the stream has not been cancelled from outside
                if (cancelResolver) {
                  cancelResolver();
                } else {
                  controller.close();
                }
              }
            }
          };

          this.wasmWorker.addEventListener("message", msgListener);
          this.post(WasmWorkerMessageType.ReadAVPacket, {
            source: this.source,
            start,
            end,
            streamType,
            streamIndex,
            seekFlag
          });
        },
        pull: () => {
          // first pull called by read don't send read next message
          if (pullCounter > 0) {
            this.post(
              WasmWorkerMessageType.ReadNextAVPacket,
              undefined,
              msgId,
            );
          }
          pullCounter++;
        },
        cancel: () => {
          return new Promise((resolve) => {
            cancelResolver = resolve;
            this.post(WasmWorkerMessageType.StopReadAVPacket, undefined, msgId);
          });
        },
      },
      queueingStrategy,
    );
  }

  /**
   * Set log level
   * @param level log level
   */
  public setLogLevel(level: AVLogLevel) {
    return this.getFromWorker(WasmWorkerMessageType.SetAVLogLevel, { level })
  }

  // ================ convenience api ================

  /**
   * Get video stream
   * @param streamType The type of media stream
   * @returns WebAVStream
   */
  public getVideoStream(streamIndex?: number) {
    return this.getAVStream(AVMediaType.AVMEDIA_TYPE_VIDEO, streamIndex);
  }

  /**
   * Get audio stream
   * @param streamIndex The index of the media stream
   * @returns 
   */
  public getAudioStream(streamIndex?: number) {
    return this.getAVStream(AVMediaType.AVMEDIA_TYPE_AUDIO, streamIndex);
  }

  /**
   * Seek video packet at a time point
   * @param time seek time in seconds
   * @param seekFlag The seek flag
   * @returns WebAVPacket
   */
  public seekVideoPacket(time: number, seekFlag?: AVSeekFlag) {
    return this.getAVPacket(time, AVMediaType.AVMEDIA_TYPE_VIDEO, undefined, seekFlag);
  }

  /**
   * Seek audio packet at a time point
   * @param time seek time in seconds
   * @param seekFlag The seek flag
   * @returns WebAVPacket
   */
  public seekAudioPacket(time: number, seekFlag?: AVSeekFlag) {
    return this.getAVPacket(time, AVMediaType.AVMEDIA_TYPE_AUDIO, undefined, seekFlag);
  }

  /**
   * Read video packet as a stream
   * @param start start time in seconds
   * @param end  end time in seconds
   * @param seekFlag The seek flag
   * @returns ReadableStream<WebAVPacket>
   */
  public readVideoPacket(start?: number, end?: number, seekFlag?: AVSeekFlag) {
    return this.readAVPacket(
      start,
      end,
      AVMediaType.AVMEDIA_TYPE_VIDEO,
      undefined,
      seekFlag,
    );
  }

  /**
   * Read audio packet as a stream
   * @param start start time in seconds
   * @param end end time in seconds
   * @param seekFlag The seek flag
   * @returns ReadableStream<WebAVPacket>
   */
  public readAudioPacket(start?: number, end?: number, seekFlag?: AVSeekFlag) {
    return this.readAVPacket(
      start,
      end,
      AVMediaType.AVMEDIA_TYPE_AUDIO,
      undefined,
      seekFlag
    );
  }

  // =========== custom api for webcodecs ===========

  /**
   * Generate VideoDecoderConfig from WebAVStream
   * @param avStream WebAVStream
   * @returns VideoDecoderConfig
   */
  public genVideoDecoderConfig(avStream: WebAVStream): VideoDecoderConfig {
    return {
      codec: avStream.codec_string,
      codedWidth: avStream.width,
      codedHeight: avStream.height,
      description:
        avStream.extradata?.length > 0
          ? avStream.extradata
          : undefined,
    };
  }

  /**
   * Generate EncodedVideoChunk from WebAVPacket
   * @param avPacket WebAVPacket
   * @returns EncodedVideoChunk
   */
  public genEncodedVideoChunk(avPacket: WebAVPacket): EncodedVideoChunk {
    return new EncodedVideoChunk({
      type: avPacket.keyframe === 1 ? "key" : "delta",
      timestamp: avPacket.timestamp * TIME_BASE,
      duration: avPacket.duration * TIME_BASE,
      data: avPacket.data,
    });
  }

  /**
   * Generate AudioDecoderConfig from WebAVStream
   * @param avStream WebAVStream
   * @returns AudioDecoderConfig
   */
  public genAudioDecoderConfig(avStream: WebAVStream): AudioDecoderConfig {
    return {
      codec: avStream.codec_string || "",
      sampleRate: avStream.sample_rate,
      numberOfChannels: avStream.channels,
      description:
        avStream.extradata?.length > 0
          ? avStream.extradata
          : undefined,
    };
  }

  /**
   * Generate EncodedAudioChunk from WebAVPacket
   * @param avPacket WebAVPacket
   * @returns EncodedAudioChunk
   */
  public genEncodedAudioChunk(avPacket: WebAVPacket): EncodedAudioChunk {
    return new EncodedAudioChunk({
      type: avPacket.keyframe === 1 ? "key" : "delta",
      timestamp: avPacket.timestamp * TIME_BASE,
      duration: avPacket.duration * TIME_BASE,
      data: avPacket.data,
    });
  }

  /**
   * Get WebCodecs VideoDecoderConfig
   * @returns VideoDecoderConfig
   */
  public async getVideoDecoderConfig() {
    const videoStream = await this.getVideoStream();

    return this.genVideoDecoderConfig(videoStream);
  }

  /**
   * Seek and return EncodedVideoChunk
   * @param time time in seconds
   * @param seekFlag The seek flag
   * @returns EncodedVideoChunk
   */
  public async seekEncodedVideoChunk(time: number, seekFlag?: AVSeekFlag) {
    const videoPacket = await this.seekVideoPacket(time, seekFlag);

    return this.genEncodedVideoChunk(videoPacket);
  }

  /**
   * Get WebCodecs AudioDecoderConfig
   * @returns AudioDecoderConfig
   */
  public async getAudioDecoderConfig() {
    const audioStream = await this.getAudioStream();

    return this.genAudioDecoderConfig(audioStream);
  }

  /**
   * Seek and return EncodedAudioChunk
   * @param time time in seconds
   * @param seekFlag The seek flag
   * @returns EncodedAudioChunk
   */
  public async seekEncodedAudioChunk(time: number, seekFlag?: AVSeekFlag) {
    const audioPacket = await this.seekAudioPacket(time, seekFlag);

    return this.genEncodedAudioChunk(audioPacket);
  }
}
