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
//   --boost-date 1    frontmatter date weight (default: 1)
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
import { loadConfig } from './config.mjs';

function parseArgs(argv) {
  const args = {
    positional: [], fuzzy: undefined, prefix: false, limit: undefined,
    json: false, context: undefined, reindex: false, cacheDir: undefined, llmContext: false,
    boostTitle: undefined, boostHeadings: undefined, boostText: undefined, boostDate: undefined,
    phrase: false,
    subcommand: null,
  };
  // Track which flags were explicitly set by CLI
  const explicit = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fuzzy') { args.fuzzy = parseFloat(argv[++i]); explicit.add('fuzzy'); }
    else if (a === '--no-fuzzy') { args.fuzzy = null; explicit.add('fuzzy'); }
    else if (a === '--prefix') args.prefix = true;
    else if (a === '--phrase') args.phrase = true;
    else if (a === '--limit') { args.limit = parseInt(argv[++i], 10); explicit.add('limit'); }
    else if (a === '--context') { args.context = parseInt(argv[++i], 10); explicit.add('context'); }
    else if (a === '--boost-title') { args.boostTitle = parseFloat(argv[++i]); explicit.add('boostTitle'); }
    else if (a === '--boost-headings') { args.boostHeadings = parseFloat(argv[++i]); explicit.add('boostHeadings'); }
    else if (a === '--boost-text') { args.boostText = parseFloat(argv[++i]); explicit.add('boostText'); }
    else if (a === '--boost-date') { args.boostDate = parseFloat(argv[++i]); explicit.add('boostDate'); }
    else if (a === '--json') { args.json = true; explicit.add('output'); }
    else if (a === '--llm-context' || a === '--md') { args.llmContext = true; explicit.add('output'); }
    else if (a === '--reindex') args.reindex = true;
    else if (a === 'mdindex') args.subcommand = 'mdindex';
    else if (a === '--cache-dir') { args.cacheDir = argv[++i]; explicit.add('cacheDir'); }
    else if (a === '--ext') { if (!args.extensions) args.extensions = []; args.extensions.push(argv[++i]); explicit.add('extensions'); }
    else if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else args.positional.push(a);
  }
  let query = args.positional[0], folder = undefined;
  if (args.positional.length >= 2) { folder = args.positional[1]; explicit.add('folder'); }
  return { ...args, folder, query, _explicit: explicit };
}

// Load cache if present and up-to-date, otherwise (re)build the index.
// Returns { miniSearch, meta, rebuilt }.
function loadOrBuildIndex(rootDir, cacheDirName, forceReindex, extensions) {
  const cacheDir = join(rootDir, cacheDirName);
  const indexPath = join(cacheDir, 'index.json');
  const metaPath = join(cacheDir, 'meta.json');

  const currentFiles = findMarkdownFiles(rootDir, extensions);
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

  buildAndSaveIndex(rootDir, cacheDirName, extensions);
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const indexJson = readFileSync(indexPath, 'utf-8');
  const miniSearch = MiniSearch.loadJSON(indexJson, MINISEARCH_OPTIONS);
  return { miniSearch, meta, rebuilt: true };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const explicit = parsed._explicit;

  // Load config file (checks target folder, then cwd)
  const config = loadConfig(parsed.folder);

  // Resolve folder: CLI > config.search_dir > '.'
  const folder = explicit.has('folder') ? parsed.folder : (config.search_dir || '.');

  // Merge: config values as base, CLI flags override when explicitly set
  const fuzzy = explicit.has('fuzzy') ? parsed.fuzzy : config.fuzzy;
  const limit = explicit.has('limit') ? parsed.limit : config.limit;
  const context = explicit.has('context') ? parsed.context : config.context;
  const cacheDir = explicit.has('cacheDir') ? parsed.cacheDir : config.cache_dir;
  const boostTitle = explicit.has('boostTitle') ? parsed.boostTitle : config.boost.title;
  const boostHeadings = explicit.has('boostHeadings') ? parsed.boostHeadings : config.boost.headings;
  const boostText = explicit.has('boostText') ? parsed.boostText : config.boost.text;
  const boostDate = explicit.has('boostDate') ? parsed.boostDate : config.boost.date;

  // Extensions from config (no CLI override for now)
  const extensions = explicit.has('extensions') ? parsed.extensions : config.extensions;

  // Output format: CLI flags override config
  let json = parsed.json;
  let llmContext = parsed.llmContext;
  if (!explicit.has('output')) {
    if (config.output === 'json') json = true;
    else if (config.output === 'llm-context') llmContext = true;
  }

  const { query, prefix, reindex, help, version, list, phrase, subcommand } = parsed;

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
  --boost-date <n>        Frontmatter date weight (default: 1)
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
    const { meta } = loadOrBuildIndex(rootDir, cacheDir, reindex, extensions);
    console.log(Object.values(meta.files).map(f => f.path).sort().join('\n'));
    process.exit(0);
  }

  if (subcommand === 'mdindex') {
    const rootDir = resolve(folder);
    buildAndSaveIndex(rootDir, cacheDir, extensions);
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
  const { miniSearch, meta, rebuilt } = loadOrBuildIndex(rootDir, cacheDir, reindex, extensions);

  if (!query) return;

  const searchOptions = {
    boost: { title: boostTitle, headings: boostHeadings, text: boostText, date: boostDate },
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
        date: r.date || null,
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
