import {
  GetAVPacketMessageData,
  GetAVPacketsMessageData,
  GetAVStreamMessageData,
  GetAVStreamsMessageData,
  GetMediaInfoMessageData,
  SetAVLogLevelMessageData,
  WebAVPacket,
  WebAVStream,
  WebMediaInfo,
} from "./types";
// @ts-ignore - Emscripten output, built via Docker (see Makefile);
// same import as wasm.worker.ts
import createModule from "./lib/web-demuxer.js";

/**
 * InlineTransport
 *
 * Runs the same WASM module as `wasm.worker.ts` directly on the current
 * thread instead of inside a `Worker`. Used by `WebDemuxer` when constructed
 * with `{ worker: false }` (e.g. inside a Web Worker, where nested workers
 * are unavailable, or on pages that want to avoid worker overhead).
 *
 * Each function mirrors its `handle*` counterpart in `wasm.worker.ts`
 * one-to-one, minus `postMessage` and transferables (same-thread calls need
 * no serialization). Streaming (`ReadAVPacket`) intentionally stays
 * worker-only: it relies on the worker message pump (`ReadNext`/`Stop`),
 * which would block the main thread inline.
 */

export async function loadInlineModule(wasmFilePath?: string): Promise<any> {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const module = await createModule({
    locateFile: (path: string, prefix: string) => {
      if (path.endsWith(".wasm") && wasmFilePath) {
        return wasmFilePath;
      }

      return prefix + path;
    },
    onRuntimeInitialized: () => {
      resolveReady();
    },
  });

  await ready;

  return module;
}

export function inlineGetAVStream(
  module: any,
  data: GetAVStreamMessageData,
): WebAVStream {
  const { source, streamType, streamIndex } = data;

  return module.getAVStream(source, streamType, streamIndex);
}

export function inlineGetAVStreams(
  module: any,
  data: GetAVStreamsMessageData,
): WebAVStream[] {
  const { source } = data;

  return module.getAVStreams(source);
}

export function inlineGetMediaInfo(
  module: any,
  data: GetMediaInfoMessageData,
): WebMediaInfo {
  const { source } = data;

  return module.getMediaInfo(source);
}

export function inlineGetAVPacket(
  module: any,
  data: GetAVPacketMessageData,
): WebAVPacket {
  const { source, time, streamType, streamIndex, seekFlag } = data;

  return module.getAVPacket(source, time, streamType, streamIndex, seekFlag);
}

export function inlineGetAVPackets(
  module: any,
  data: GetAVPacketsMessageData,
): WebAVPacket[] {
  const { source, time, seekFlag } = data;

  return module.getAVPackets(source, time, seekFlag);
}

export function inlineSetAVLogLevel(
  module: any,
  data: SetAVLogLevelMessageData,
): void {
  const { level } = data;

  module.setAVLogLevel(level);
}
