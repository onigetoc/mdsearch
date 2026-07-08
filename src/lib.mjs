// lib.mjs — shared functions between index-md.mjs and search-md.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';

// node_modules is explicit (no dot prefix but must always be skipped: large volume, never useful .md).
// Every folder starting with "." is automatically ignored (same convention as Obsidian:
// .git, .obsidian, .mdsearch, .mdsearch-tool, .trash, etc. — no need to list them one by one).
export const EXTRA_IGNORED_DIRS = new Set(['node_modules']);

function isIgnoredDir(name) {
  return name.startsWith('.') || EXTRA_IGNORED_DIRS.has(name);
}

// ---------- Directory walk ----------

export function findMarkdownFiles(rootDir) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (isIgnoredDir(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        const st = statSync(fullPath);
        results.push({
          absolutePath: fullPath,
          relativePath: relative(rootDir, fullPath),
          mtimeMs: st.mtimeMs,
        });
      }
    }
  }

  walk(rootDir);
  return results;
}

// Lightweight folder signature: detects changes without re-reading everything.
// Based on file count + most recent modification time.
export function computeSignature(files) {
  let maxMtimeMs = 0;
  for (const f of files) if (f.mtimeMs > maxMtimeMs) maxMtimeMs = f.mtimeMs;
  return { count: files.length, maxMtimeMs };
}

export function signaturesMatch(a, b) {
  return a && b && a.count === b.count && a.maxMtimeMs === b.maxMtimeMs;
}

// ---------- Front-matter / title / description parsing ----------

export function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, content: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      let value = kv[2].trim();
      value = value.replace(/^["']|["']$/g, '');
      data[kv[1]] = value;
    }
  }
  return { data, content: raw.slice(match[0].length) };
}

export function extractTitle(content, data, filePath) {
  if (data.title) return data.title;
  const h1 = content.match(/^#{1,2}\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return basename(filePath, '.md');
}

export function extractDescription(content, data) {
  if (data.description) return data.description;

  const lines = content.split(/\r?\n/);
  const paragraph = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (started) break;
      continue;
    }
    if (trimmed.startsWith('#')) continue;
    started = true;
    paragraph.push(trimmed);
  }
  let text = paragraph.join(' ');
  text = text.replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return text.length > 200 ? text.slice(0, 197) + '…' : text;
}

// Extracts all markdown headings (# to ######) from a document, concatenated into one field
// to allow giving them a different search weight (see MINISEARCH_OPTIONS/boost).
export function extractHeadings(content) {
  const matches = [...content.matchAll(/^#{1,6}\s+(.+)$/gm)];
  return matches.map(m => m[1].trim()).join(' ');
}

// Loads a full document (used only during indexing, expensive since it reads the disk)
export function loadDocument(fileInfo, id) {
  const raw = readFileSync(fileInfo.absolutePath, 'utf-8');
  const { data, content } = parseFrontMatter(raw);
  return {
    id,
    path: fileInfo.relativePath,
    title: extractTitle(content, data, fileInfo.absolutePath),
    description: extractDescription(content, data),
    headings: extractHeadings(content), // separate field, boosted higher than body text
    text: content, // used for tokenization, never stored in serialized index
  };
}

// ---------- Accent/case normalization (shared by index + search) ----------

export function normalizeForMatch(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const processTerm = (term) => normalizeForMatch(term);

// Bump if indexed field structure changes (e.g. new field).
// Lets search-md.mjs detect an incompatible cache and force re-index.
export const SCHEMA_VERSION = 2;

export const MINISEARCH_OPTIONS = {
  fields: ['title', 'headings', 'text'],
  storeFields: ['title', 'description', 'path'],
  processTerm,
};

// Default weights: document title counts most, then headings (# ## ###...),
// then body text. Adjustable via --boost-title / --boost-headings / --boost-text.
export const DEFAULT_BOOST = { title: 3, headings: 2, text: 1 };

// Fuzzy enabled by default (tolerates typos/minor accent mistakes). 0 = disabled.
export const DEFAULT_FUZZY = 0.2;

// ---------- Snippet extraction (on-demand read, not cached) ----------

function findMatchingLineIndex(lines, terms) {
  const normalizedTerms = terms.map(normalizeForMatch).filter(Boolean);
  if (normalizedTerms.length === 0) return -1;

  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = normalizeForMatch(lines[i]);
    if (normalizedTerms.some(t => normalizedLine.includes(t))) return i;
  }
  return -1;
}

export function extractSnippetFromFile(absolutePath, terms, contextLines) {
  if (contextLines <= 0) return null;

  let raw;
  try {
    raw = readFileSync(absolutePath, 'utf-8');
  } catch {
    return null;
  }
  const { content } = parseFrontMatter(raw);
  const lines = content.split(/\r?\n/);

  const matchIndex = findMatchingLineIndex(lines, terms);
  if (matchIndex === -1) return null;

  const start = Math.max(0, matchIndex - contextLines);
  const end = Math.min(lines.length - 1, matchIndex + contextLines);

  const snippetLines = [];
  for (let i = start; i <= end; i++) {
    const marker = i === matchIndex ? '→ ' : '  ';
    snippetLines.push(`line ${i + 1}: ${marker}${lines[i]}`);
  }
  return { snippet: snippetLines.join('\n'), line: matchIndex + 1 };
}
