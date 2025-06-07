import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
interface TestFile {
  path: string;
  name: string;
}

const pageUrl = 'http://localhost:5173';
const inputFileSelector = '#example-get-media-info-file';

const getTestFiles = (): TestFile[] => {
  const samplesDir = path.join(__dirname, '..', 'samples');
  return fs.readdirSync(samplesDir)
    .map(file => ({
      path: path.join(samplesDir, file),
      name: file
    }));
};

for (const {path: testFilePath, name} of getTestFiles()) {
  test(`should get correct media info for ${name}`, async ({ page }) => {
    await page.goto(pageUrl);
    await page.setInputFiles(inputFileSelector, testFilePath);

    const mediaInfo = await page.evaluate(async (inputFileSelector) => {
      const file = (document.querySelector(inputFileSelector) as HTMLInputElement).files![0];
      await window.demuxer.load(file);
      return await window.demuxer.getMediaInfo();
    }, inputFileSelector);

    const mediaInfoJsonPath = path.join(__dirname, '..', 'fixtures', 'mediainfo', name.replace(/\.[^.]+$/, '.json'));
    const expectedInfo = JSON.parse(fs.readFileSync(mediaInfoJsonPath, 'utf-8'));

    expect(mediaInfo).toBeDefined();

    const normalizeMediaInfo = (info: any) => {
      const { filename, url, ...rest } = info;
      return {
        ...rest,
        streams: info.streams.map((stream: any) => {
          return {
            ...stream,
            extradata: Array.from(stream.extradata || []),
          };
        })
      };
    };

    const normalizedActual = normalizeMediaInfo(mediaInfo);
    const normalizedExpected = normalizeMediaInfo(expectedInfo);
    
    try {
      expect(normalizedActual).toEqual(normalizedExpected);
    } catch (error) {
      console.log('Actual MediaInfo:', JSON.stringify(normalizedActual, null, 2));
      console.log('Expected MediaInfo:', JSON.stringify(normalizedExpected, null, 2));
      throw error;
    }
  });

  test(`should get correct video packet for ${name}`, async ({ page }) => {
    await page.goto(pageUrl);
    await page.setInputFiles(inputFileSelector, testFilePath);

    const videoPacket = await page.evaluate(async (inputFileSelector) => {
      const file = (document.querySelector(inputFileSelector) as HTMLInputElement).files![0];
      await window.demuxer.load(file);
      return await window.demuxer.seekMediaPacket('video', 1, 4);
    }, inputFileSelector);

    expect(videoPacket).toBeDefined();
    expect(videoPacket.size).toBeGreaterThan(0);
    expect(videoPacket.data).toBeDefined();
    expect(videoPacket.data.buffer).toBeDefined();
    expect(videoPacket.timestamp).toBeGreaterThan(0);
    expect(videoPacket.duration).toBeGreaterThan(0);
  });

  test(`should get correct audio packet for ${name}`, async ({ page }) => {
    await page.goto(pageUrl);
    await page.setInputFiles(inputFileSelector, testFilePath);

    const audioPacket = await page.evaluate(async (inputFileSelector) => {
      const file = (document.querySelector(inputFileSelector) as HTMLInputElement).files![0];
      await window.demuxer.load(file);
      return await window.demuxer.seekMediaPacket('audio', 1, 4);
    }, inputFileSelector);

    expect(audioPacket).toBeDefined();
    expect(audioPacket.size).toBeGreaterThan(0);
    expect(audioPacket.data).toBeDefined();
    expect(audioPacket.data.buffer).toBeDefined();
    expect(audioPacket.data.buffer.byteLength).toBeGreaterThan(0);
    expect(audioPacket.timestamp).toBeGreaterThan(0);
  });
}