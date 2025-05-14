import { WebDemuxer } from '../src';

declare global {
  interface Window {
    demuxer: WebDemuxer;
  }
}
