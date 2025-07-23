const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const { nodeExternalsPlugin } = require('esbuild-node-externals');

async function copyStaticFiles() {
  const staticFiles = [
    {
      src: 'src/hive-mind/database/schema.sql',
      dest: 'dist/schema.sql'
    },
    {
      src: 'src/swarm/claude-worker.js',
      dest: 'dist/claude-worker.js'
    }
  ];

  for (const file of staticFiles) {
    try {
      await fs.promises.copyFile(file.src, file.dest);
      console.log(`Copied ${file.src} to ${file.dest}`);
    } catch (error) {
      console.warn(`Warning: Could not copy ${file.src}:`, error.message);
    }
  }
}

(async () => {
  try {
    // Ensure dist directory exists
    await fs.ensureDir('dist');
    
    // Main CLI entrypoint only
    await esbuild.build({
      entryPoints: ['src/cli/main.ts'],
      bundle: true,
      platform: 'node',
      outfile: 'dist/main.js',
      format: 'esm',
      target: 'node18',
      plugins: [
          nodeExternalsPlugin()
      ],
      banner: {
        js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
      },
      external: [
        'sqlite3',
        'better-sqlite3',
        'canvas',
        'sharp',
        'puppeteer',
        'playwright',
        '@tensorflow/tfjs-node',
        'fsevents'
      ],
      sourcemap: false,
      minify: false
    });

    console.log('✅ Build completed successfully');
    
    // Copy static files
    await copyStaticFiles();
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
})(); 