import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import babel from "@rollup/plugin-babel";
import fs from 'fs';
import path from 'path';
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => ({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "web-demuxer",
      fileName: "web-demuxer",
    },
    rollupOptions: {
      plugins: [
        babel({
          presets: [
            [
              "@babel/preset-env",
              {
                targets: "> 0.25%, not dead",
              },
            ],
          ],
          extensions: [".ts"],
          babelHelpers: "bundled",
        }),
      ],
    },
  },
  plugins: [
    /**
     * TODO: better WASM file handling strategies
     * vite does not support disabling the core plugin 'vite:worker-import-meta-url'
     * so WASM files will be inlined as base64 encoded in the JS file
     * this plugin will move the WASM files to a temporary directory during build
     * and restore them after the build is complete
     */
    (() => {
      const tempDir = path.resolve(__dirname, '.temp-wasm');
      const sourceDir = path.resolve(__dirname, 'src/lib');

      return {
        name: 'vite:wasm-temp-isolate',
        apply: 'build' as const,
        async buildStart() {
          const files = await fs.promises.readdir(sourceDir);
          const wasmFiles = files.filter(file => file.endsWith('.wasm'));

          if (!fs.existsSync(tempDir)) {
            await fs.promises.mkdir(tempDir, { recursive: true });
          }

          for (const file of wasmFiles) {
            const sourcePath = path.join(sourceDir, file);
            const tempPath = path.join(tempDir, file);
            try {
              await fs.promises.rename(sourcePath, tempPath);
              console.log(`Moved to temp: ${sourcePath} -> ${tempPath}`);
            } catch (err) {
              console.error(`Error moving ${sourcePath}:`, err);
            }
          }
        },
        async buildEnd() {
          try {
            const tempFiles = await fs.promises.readdir(tempDir);
            for (const file of tempFiles) {
              const tempPath = path.join(tempDir, file);
              const sourcePath = path.join(sourceDir, file);
              await fs.promises.rename(tempPath, sourcePath);
              console.log(`Restored: ${tempPath} -> ${sourcePath}`);
            }
            await fs.promises.rmdir(tempDir);
          } catch (err) {
            console.error('Error restoring wasm files:', err);
          }
        },
        closeBundle() {
          if (fs.existsSync(tempDir)) {
            const tempFiles = fs.readdirSync(tempDir);
            for (const file of tempFiles) {
              const tempPath = path.join(tempDir, file);
              const sourcePath = path.join(sourceDir, file);
              fs.renameSync(tempPath, sourcePath);
              console.log(`Restored (cleanup): ${tempPath} -> ${sourcePath}`);
            }
            fs.rmdirSync(tempDir);
          }
        }
      };
    })(),
    dts({ rollupTypes: true }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/lib/*.wasm',
          dest: 'wasm-files'
        }
      ]
    })
  ],
}));
