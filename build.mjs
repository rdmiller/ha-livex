// Bundles src/livex-card.ts into dist/livex-card.js, the one file HACS installs.

import { readFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const { version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
await esbuild.build({
  entryPoints: ['src/livex-card.ts'],
  outfile: 'dist/livex-card.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
});
