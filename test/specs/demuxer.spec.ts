import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
interface TestFile {
  path: string;
  name: string;
}

const getTestFiles = (): TestFile[] => {
  const samplesDir = path.join(__dirname, '..', 'samples');
  return fs.readdirSync(samplesDir)
    .filter(file => /\.(avi|mp4|mkv|webm|flv)$/.test(file))
    .map(file => ({
      path: path.join(samplesDir, file),
      name: file
    }));
};

for (const {path: testFilePath, name} of getTestFiles()) {
  test(`should get correct media info for ${name}`, async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.setInputFiles('#example-get-media-info-file', testFilePath);

    const mediaInfo = await page.evaluate(async () => {
      const input = document.getElementById('example-get-media-info-file') as HTMLInputElement;
      if (!input) throw new Error('Input element not found');
      const file = input.files?.[0];
      if (!file) throw new Error('No file selected');
      await window.demuxer.load(file);
      return await window.demuxer.getMediaInfo();
    });

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
}