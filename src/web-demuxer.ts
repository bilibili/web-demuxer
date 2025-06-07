import {
  AVLogLevel,
  AVMediaType,
  AVSeekFlag,
  WasmWorkerMessageData,
  WasmWorkerMessageType,
  WebAVPacket,
  WebAVStream,
  WebMediaInfo,
  MediaType,
  MediaTypeToChunk,
  MediaTypeToConfig,
  MediaTypes,
  MEDIA_TYPE_TO_AVMEDIA_TYPE,
} from "./types";
import WasmWorker from "./wasm.worker.ts?worker&inline";

const TIME_BASE = 1e6;

export interface WebDemuxerOptions {
  /**
   * custom wasm file path
   */
  wasmFilePath?: string;
}

/**
 * WebDemuxer
 * 
 * A class to demux media files in the browser using WebAssembly.
 *
 * @example
 * ```typescript
 * const demuxer = new WebDemuxer();
 * await demuxer.load(file);
 * const encodedChunk = await demuxer.seek('video', 10);
 * ```
 */
export class WebDemuxer {
  private wasmWorker: Worker;
  private wasmWorkerLoadStatus: Promise<void>;
  private msgId: number;

  public source?: File | string;

  constructor(options?: WebDemuxerOptions) {
    this.wasmWorker = new WasmWorker({
      name: 'web-demuxer'
    });
    this.wasmWorkerLoadStatus = new Promise((resolve, reject) => {
      this.wasmWorker.addEventListener("message", (e) => {
        const { type, errMsg } = e.data;

        if (type === WasmWorkerMessageType.WasmWorkerLoaded) {
          this.post(WasmWorkerMessageType.LoadWASM, {
            wasmFilePath: options?.wasmFilePath,
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

  // ================ Base API ================

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

  // ================ Convenience API ================

  /**
   * Get media stream (video or audio)
   * @param type The type of media stream ('video' or 'audio')
   * @param streamIndex The index of the media stream
   * @returns WebAVStream
   */
  public getMediaStream(type: MediaType, streamIndex?: number) {
    return this.getAVStream(MEDIA_TYPE_TO_AVMEDIA_TYPE[type], streamIndex);
  }

  /**
   * Seek media packet at a time point
   * @param type The type of media ('video' or 'audio')
   * @param time seek time in seconds
   * @param seekFlag The seek flag
   * @returns WebAVPacket
   */
  public seekMediaPacket(type: MediaType, time: number, seekFlag?: AVSeekFlag) {
    return this.getAVPacket(time, MEDIA_TYPE_TO_AVMEDIA_TYPE[type], undefined, seekFlag);
  }

  /**
   * Read media packet as a stream
   * @param type The type of media ('video' or 'audio')
   * @param start start time in seconds
   * @param end end time in seconds
   * @param seekFlag The seek flag
   * @returns ReadableStream<WebAVPacket>
   */
  public readMediaPacket(type: MediaType, start?: number, end?: number, seekFlag?: AVSeekFlag) {
    return this.readAVPacket(
      start,
      end,
      MEDIA_TYPE_TO_AVMEDIA_TYPE[type],
      undefined,
      seekFlag,
    );
  }

  // =========== WebCodecs API ===========

  /**
   * Generate decoder config for video or audio
   * @param type The type of media ('video' or 'audio')
   * @param avStream WebAVStream
   * @returns VideoDecoderConfig | AudioDecoderConfig
   */
  public genDecoderConfig<T extends MediaType>(
    type: T,
    avStream: WebAVStream
  ): MediaTypeToConfig[T] {
    if (type === MediaTypes.VIDEO) {
      return {
        codec: avStream.codec_string,
        codedWidth: avStream.width,
        codedHeight: avStream.height,
        description: avStream.extradata?.length > 0 ? avStream.extradata : undefined,
      } as MediaTypeToConfig[T];
    } else {
      return {
        codec: avStream.codec_string || "",
        sampleRate: avStream.sample_rate,
        numberOfChannels: avStream.channels,
        description: avStream.extradata?.length > 0 ? avStream.extradata : undefined,
      } as MediaTypeToConfig[T];
    }
  }

  /**
   * Generate encoded chunk for video or audio
   * @param type The type of media ('video' or 'audio')
   * @param avPacket WebAVPacket
   * @returns EncodedVideoChunk | EncodedAudioChunk
   */
  public genEncodedChunk<T extends MediaType>(
    type: T,
    avPacket: WebAVPacket
  ): MediaTypeToChunk[T] {
    const chunkData = {
      type: avPacket.keyframe === 1 ? "key" as const : "delta" as const,
      timestamp: avPacket.timestamp * TIME_BASE,
      duration: avPacket.duration * TIME_BASE,
      data: avPacket.data,
    };

    return (type === MediaTypes.VIDEO
      ? new EncodedVideoChunk(chunkData)
      : new EncodedAudioChunk(chunkData)) as MediaTypeToChunk[T];
  }

  /**
   * Get decoder config for WebCodecs
   * @param type The type of media ('video' or 'audio')
   * @returns Promise<VideoDecoderConfig | AudioDecoderConfig>
   */
  public getDecoderConfig<T extends MediaType>(type: T): Promise<MediaTypeToConfig[T]> {
    return this.getMediaStream(type).then(stream => this.genDecoderConfig(type, stream));
  }

  /**
   * Seek and return encoded chunk for WebCodecs
   * @param type The type of media ('video' or 'audio')
   * @param time time in seconds
   * @param seekFlag The seek flag
   * @returns ReadableStream<EncodedVideoChunk | EncodedAudioChunk>
   */
  public seek<T extends MediaType>(
    type: T,
    time: number,
    seekFlag?: AVSeekFlag
  ): Promise<MediaTypeToChunk[T]> {
    return this.seekMediaPacket(type, time, seekFlag).then(packet => this.genEncodedChunk(type, packet));
  }

  /**
   * Read encoded chunks as a stream for WebCodecs
   * @param type The type of media ('video' or 'audio')
   * @param start start time in seconds
   * @param end end time in seconds
   * @param seekFlag The seek flag
   * @returns ReadableStream<EncodedVideoChunk | EncodedAudioChunk>
   */
  public read<T extends MediaType>(
    type: T,
    start?: number,
    end?: number,
    seekFlag?: AVSeekFlag
  ): ReadableStream<MediaTypeToChunk[T]> {
    const avPackets = this.readMediaPacket(type, start, end, seekFlag);
    const self = this;
    
    return new ReadableStream({
      async start(controller) {
        const reader = avPackets.getReader();
        while (true) {
          const { done, value: packet } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          
          const chunk = self.genEncodedChunk(type, packet);
          controller.enqueue(chunk);
        }
      },
    });
  }
}
