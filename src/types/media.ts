import { AVMediaType } from './avutil';

const VIDEO = 'video' as const;
const AUDIO = 'audio' as const;

export type Video = typeof VIDEO;
export type Audio = typeof AUDIO;
export type MediaType = Video | Audio;

export const MediaTypes = {
  VIDEO,
  AUDIO
} as const;

export const MEDIA_TYPE_TO_AVMEDIA_TYPE = {
  [VIDEO]: AVMediaType.AVMEDIA_TYPE_VIDEO,
  [AUDIO]: AVMediaType.AVMEDIA_TYPE_AUDIO
} as const;

export type MediaTypeToConfig = {
  [VIDEO]: VideoDecoderConfig;
  [AUDIO]: AudioDecoderConfig;
}

export type MediaTypeToChunk = {
  [VIDEO]: EncodedVideoChunk;
  [AUDIO]: EncodedAudioChunk;
}
