#!/usr/bin/env node
// search-md.mjs — search from cache (builds index if missing or stale)
//
// Usage:
//   mdsearch "<query>" [<folder>] [options]
//
// Options:
//   -h, --help        show this help message
//   -v, --version     show version number
//   --fuzzy 0.2       fuzzy search (ON by default at 0.2, tolerates typos)
//   --no-fuzzy        disable fuzzy search
//   --prefix          prefix search
//   --limit 10        max results (default: 10)
//   --context 2       lines before/after match (default: 2, 0 = disabled)
//   --boost-title 3   title field weight (default: 3)
//   --boost-headings 2  heading # ## ### weight (default: 2)
//   --boost-text 1    body text weight (default: 1)
//   --json            raw JSON output
//   --llm-context     compact text output ready for LLM prompts
//   --reindex         force index rebuild even if cache looks fresh
//   --cache-dir       cache folder name (default: .mdsearch)
//
// Subcommands:
//   mdindex [folder]  rebuild index for folder

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import MiniSearch from 'minisearch';
import {
  findMarkdownFiles,
  computeSignature,
  signaturesMatch,
  extractSnippetFromFile,
  parseFrontMatter,
  MINISEARCH_OPTIONS,
  DEFAULT_BOOST,
  DEFAULT_FUZZY,
  SCHEMA_VERSION,
} from './lib.mjs';
import { buildAndSaveIndex } from './index-md.mjs';

function parseArgs(argv) {
  const args = {
    positional: [], fuzzy: DEFAULT_FUZZY, prefix: false, limit: 10,
    json: false, context: 2, reindex: false, cacheDir: '.mdsearch', llmContext: false,
    boostTitle: DEFAULT_BOOST.title, boostHeadings: DEFAULT_BOOST.headings, boostText: DEFAULT_BOOST.text,
    phrase: false,
    subcommand: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fuzzy') args.fuzzy = parseFloat(argv[++i]);
    else if (a === '--no-fuzzy') args.fuzzy = null;
    else if (a === '--prefix') args.prefix = true;
    else if (a === '--phrase') args.phrase = true;
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--context') args.context = parseInt(argv[++i], 10);
    else if (a === '--boost-title') args.boostTitle = parseFloat(argv[++i]);
    else if (a === '--boost-headings') args.boostHeadings = parseFloat(argv[++i]);
    else if (a === '--boost-text') args.boostText = parseFloat(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (a === '--llm-context' || a === '--md') args.llmContext = true;
    else   if (a === '--reindex') args.reindex = true;
    else if (a === 'mdindex') args.subcommand = 'mdindex';
    else if (a === '--cache-dir') args.cacheDir = argv[++i];
    else if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else args.positional.push(a);
  }
  let query = args.positional[0], folder = '.';
  if (args.positional.length >= 2) folder = args.positional[1];
  return { ...args, folder, query };
}

// Load cache if present and up-to-date, otherwise (re)build the index.
// Returns { miniSearch, meta, rebuilt }.
function loadOrBuildIndex(rootDir, cacheDirName, forceReindex) {
  const cacheDir = join(rootDir, cacheDirName);
  const indexPath = join(cacheDir, 'index.json');
  const metaPath = join(cacheDir, 'meta.json');

  const currentFiles = findMarkdownFiles(rootDir);
  const currentSignature = computeSignature(currentFiles);

  if (!forceReindex && existsSync(indexPath) && existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      const schemaOk = meta.schemaVersion === SCHEMA_VERSION;
      if (schemaOk && signaturesMatch(meta.signature, currentSignature)) {
        const indexJson = readFileSync(indexPath, 'utf-8');
        const miniSearch = MiniSearch.loadJSON(indexJson, MINISEARCH_OPTIONS);
        return { miniSearch, meta, rebuilt: false };
      }
    } catch {
      // corrupted or unreadable cache -> rebuild below
    }
  }

  buildAndSaveIndex(rootDir, cacheDirName);
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const indexJson = readFileSync(indexPath, 'utf-8');
  const miniSearch = MiniSearch.loadJSON(indexJson, MINISEARCH_OPTIONS);
  return { miniSearch, meta, rebuilt: true };
}

function main() {
  const { folder, query, fuzzy, prefix, limit, json, context, reindex, cacheDir, llmContext,
    boostTitle, boostHeadings, boostText, help, version, list, phrase, subcommand } = parseArgs(process.argv.slice(2));

  if (version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  if (help) {
    console.log(`Usage: mdsearch <query> [folder] [options]

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  --list                  List all indexed files
  --fuzzy <n>             Fuzzy search tolerance (default: 0.2)
  --no-fuzzy              Disable fuzzy search
  --prefix                Enable prefix search
  --phrase                Enable exact phrase search (sequence of terms)
  --limit <n>             Max results (default: 10)
  --context <n>           Lines of context around match (default: 2, 0 = disabled)
  --boost-title <n>       Title field weight (default: 3)
  --boost-headings <n>    Heading weight (default: 2)
  --boost-text <n>        Body text weight (default: 1)
  --json                  Output as JSON
  --llm-context, --md     Compact LLM-ready output
  --reindex               Force index rebuild
  --cache-dir <dir>       Cache directory name (default: .mdsearch)
  mdindex <folder>        Rebuild index for folder
`);
    process.exit(0);
  }

  if (list) {
    const rootDir = resolve(folder);
    // loadOrBuildIndex handles the index creation if it doesn't exist
    const { meta } = loadOrBuildIndex(rootDir, cacheDir, reindex);
    console.log(Object.values(meta.files).map(f => f.path).sort().join('\n'));
    process.exit(0);
  }

  if (subcommand === 'mdindex') {
    const rootDir = resolve(folder);
    buildAndSaveIndex(rootDir, cacheDir);
    console.log(`Index rebuilt for folder: ${rootDir}`);
    process.exit(0);
  }

  if (!query && !reindex) {
    console.error('Usage: mdsearch <query> [folder] [options]\nTry --help for details.');
    process.exit(1);
  }

  const rootDir = resolve(folder);
  if (!existsSync(rootDir)) {
    console.error(`Error: folder "${folder}" does not exist.`);
    process.exit(1);
  }

  const startTime = performance.now();
  const { miniSearch, meta, rebuilt } = loadOrBuildIndex(rootDir, cacheDir, reindex);

  if (!query) return;

  const searchOptions = {
    boost: { title: boostTitle, headings: boostHeadings, text: boostText },
    combineWith: 'OR',
  };
  if (fuzzy !== null && !Number.isNaN(fuzzy) && fuzzy > 0) searchOptions.fuzzy = fuzzy;
  if (prefix) searchOptions.prefix = true;

  let rawResults = miniSearch.search(query, searchOptions);

  if (phrase) {
    const phrase = query.toLowerCase();
    rawResults = rawResults.filter(r => {
      const fileMeta = meta.files[r.id];
      if (!fileMeta) return false;
      // Read content to verify the phrase exists
      const raw = readFileSync(fileMeta.absolutePath, 'utf-8');
      const { content } = parseFrontMatter(raw);
      return content.toLowerCase().includes(phrase);
    });
  }

  rawResults = rawResults.slice(0, limit);

  const maxScore = rawResults.length > 0 ? rawResults[0].score : 1;

  const results = rawResults.map(r => {
    const fileMeta = meta.files[r.id];
    const extracted = fileMeta ? extractSnippetFromFile(fileMeta.absolutePath, r.terms, context) : null;
    const snippet = extracted ? extracted.snippet : null;
    const line = extracted ? extracted.line : null;
    return { ...r, snippet, line, normalizedScore: maxScore > 0 ? r.score / maxScore : 0 };
  });

  if (json) {
    const elapsed = Math.round(performance.now() - startTime);
    console.log(JSON.stringify({
      query,
      execution_time_ms: elapsed,
      total_results: results.length,
      results: results.map(r => ({
        title: r.title,
        description: r.description,
        path: r.path,
        line: r.line,
        score: +r.normalizedScore.toFixed(2),
        snippet: r.snippet,
      })),
    }, null, 2));
    return;
  }

  if (llmContext) {
    const elapsed = Math.round(performance.now() - startTime);
    if (results.length === 0) {
      console.log(`---\nquery: "${query}"\nexecution_time_ms: ${elapsed}\nformat: markdown\n---\n\n(no relevant results found in notes)`);
      return;
    }
    const blocks = results.map(r => {
      const body = r.snippet
        ? r.snippet.replace(/^line \d+: → /gm, '').replace(/^line \d+:  /gm, '')
        : r.description;
      return `### ${r.title}\nSource: ${r.path}\nConfidence: ${r.normalizedScore.toFixed(2)}\n\n${body}`;
    });
    console.log(`---\nquery: "${query}"\nexecution_time_ms: ${elapsed}\nformat: markdown\n---\n\n${blocks.join('\n\n---\n\n')}`);
    return;
  }

  console.error(
    rebuilt
      ? `(index (re)built — ${meta.signature.count} .md files)\n`
      : `(index loaded from cache — ${meta.signature.count} .md files)\n`
  );

  if (results.length === 0) {
    console.log('No results.');
    return;
  }

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`<!-- METADATA: ${JSON.stringify({ query, execution_time_ms: elapsed })} -->`);

  for (const r of results) {
    console.log(`• ${r.title}`);
    console.log(`  ${r.description}`);
    console.log(`  ${r.path}  (score: ${r.normalizedScore.toFixed(2)})`);
    if (r.snippet) {
      console.log('');
      console.log(r.snippet.split('\n').map(l => '  ' + l).join('\n'));
    }
    console.log('');
  }
}

main();
