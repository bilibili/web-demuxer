import { AVLogLevel, AVMediaType, AVSeekFlag } from "./avutil";

export enum WasmWorkerMessageType {
  WasmWorkerLoaded = "WasmWorkerLoaded",
  WASMRuntimeInitialized = "WASMRuntimeInitialized",
  LoadWASM = "LoadWASM",
  GetAVPacket = "GetAVPacket",
  GetAVPackets = "GetAVPackets",
  GetAVStream = "GetAVStream",
  GetAVStreams = "GetAVStreams",
  GetMediaInfo = "GetMediaInfo",
  ReadAVPacket = "ReadAVPacket",
  AVPacketStream = "AVPacketStream",
  ReadNextAVPacket = "ReadNextAVPacket",
  StopReadAVPacket = "StopReadAVPacket",
  SetAVLogLevel = "SetAVLogLevel",
}

export type WasmWorkerMessageData =
  | GetAVPacketMessageData
  | GetAVPacketsMessageData
  | GetAVStreamMessageData
  | GetAVStreamsMessageData
  | ReadAVPacketMessageData
  | LoadWASMMessageData
  | SetAVLogLevelMessageData
  | GetMediaInfoMessageData;

export interface GetAVStreamMessageData {
  source: File | string;
  streamType: AVMediaType;
  streamIndex: number;
}

export interface GetAVStreamsMessageData {
  source: File | string;
}

export interface GetAVPacketMessageData {
  source: File | string;
  time: number;
  streamType: AVMediaType;
  streamIndex: number;
  seekFlag: AVSeekFlag;
}

export interface GetAVPacketsMessageData {
  source: File | string;
  time: number;
  seekFlag: AVSeekFlag;
}

export interface ReadAVPacketMessageData {
  source: File | string;
  start: number;
  end: number;
  streamType: AVMediaType;
  streamIndex: number;
  seekFlag: AVSeekFlag;
}

export interface LoadWASMMessageData {
  wasmFilePath?: string;
}

export interface GetMediaInfoMessageData {
  source: File | string;
}

export interface SetAVLogLevelMessageData {
  level: AVLogLevel;
}

export interface WasmWorkerMessage {
  type: WasmWorkerMessageType;
  data: WasmWorkerMessageData;
  msgId: number;
}
