import { AVMediaType } from './avutil';

const VIDEO = 'video' as const;
const AUDIO = 'audio' as const;
const SUBTITLE = 'subtitle' as const;

export type Video = typeof VIDEO;
export type Audio = typeof AUDIO;
export type Subtitle = typeof SUBTITLE;
export type MediaType = Video | Audio | Subtitle;
export type WebCodecsSupportedMediaType = Extract<MediaType, Video | Audio>;

export const MediaTypes = {
  VIDEO,
  AUDIO,
  SUBTITLE
} as const;

export const MEDIA_TYPE_TO_AVMEDIA_TYPE = {
  [VIDEO]: AVMediaType.AVMEDIA_TYPE_VIDEO,
  [AUDIO]: AVMediaType.AVMEDIA_TYPE_AUDIO,
  [SUBTITLE]: AVMediaType.AVMEDIA_TYPE_SUBTITLE
} as const;

// Extended VideoDecoderConfig to include rotation property
export interface ExtendedVideoDecoderConfig extends VideoDecoderConfig {
  rotation?: number;
}

export type MediaTypeToConfig = {
  [VIDEO]: ExtendedVideoDecoderConfig;
  [AUDIO]: AudioDecoderConfig;
}

export type MediaTypeToChunk = {
  [VIDEO]: EncodedVideoChunk;
  [AUDIO]: EncodedAudioChunk;
}
