#!/usr/bin/env node
// index-md.mjs — builds MiniSearch index and saves to JSON
//
// Usage:
//   node index-md.mjs [<folder>] [--cache-dir .mdsearch]
//
// Creates in the cache folder:
//   index.json  → serialized MiniSearch index (miniSearch.toJSON())
//   meta.json   → folder signature + id -> absolute path mapping

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import MiniSearch from 'minisearch';
import {
  findMarkdownFiles,
  loadDocument,
  computeSignature,
  MINISEARCH_OPTIONS,
  SCHEMA_VERSION,
} from './lib.mjs';

export function buildAndSaveIndex(folder, cacheDirName = '.mdsearch', extensions) {
  const rootDir = resolve(folder);
  const files = findMarkdownFiles(rootDir, extensions);
  const signature = computeSignature(files);

  const documents = files.map((f, i) => loadDocument(f, i));

  const miniSearch = new MiniSearch(MINISEARCH_OPTIONS);
  miniSearch.addAll(documents);

  const cacheDir = join(rootDir, cacheDirName);
  mkdirSync(cacheDir, { recursive: true });

  const meta = {
    rootDir,
    builtAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    signature,
    files: Object.fromEntries(
      files.map((f, i) => [i, { path: f.relativePath, absolutePath: f.absolutePath }])
    ),
  };

  writeFileSync(join(cacheDir, 'index.json'), JSON.stringify(miniSearch.toJSON()));
  writeFileSync(join(cacheDir, 'meta.json'), JSON.stringify(meta, null, 2));

  return { fileCount: files.length, cacheDir };
}

function parseArgs(argv) {
  const args = { positional: [], cacheDir: '.mdsearch' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cache-dir') args.cacheDir = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else args.positional.push(a);
  }
  return { ...args, folder: args.positional[0] };
}

// Only run CLI when file is executed directly (not when imported by search-md.mjs)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { folder, cacheDir, help, version } = parseArgs(process.argv.slice(2));

  if (version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  if (help) {
    console.log(`Usage: mdindex [folder] [options]

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  --cache-dir <dir>       Cache directory name (default: .mdsearch)
`);
    process.exit(0);
  }

  if (!folder) folder = '.';

  const start = Date.now();
  const { fileCount, cacheDir: dir } = buildAndSaveIndex(folder, cacheDir);
  const ms = Date.now() - start;

  console.log(`Index built: ${fileCount} .md files indexed in ${ms}ms`);
  console.log(`Cache saved to: ${dir}`);
}
