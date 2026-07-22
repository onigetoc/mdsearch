// config.mjs — load mdsearch.config.json if present, merge with defaults
//
// Resolution order (later wins):
//   1. Hardcoded defaults
//   2. mdsearch.config.json in target folder
//   3. mdsearch.config.json in cwd (if different from target)
//   4. CLI flags (handled by caller)

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_BOOST, DEFAULT_FUZZY } from './lib.mjs';

const CONFIG_FILENAME = 'mdsearch.json';

// Hardcoded defaults (same as current behavior)
export const DEFAULTS = {
  search_dir: '.',
  context: 2,
  limit: 10,
  fuzzy: DEFAULT_FUZZY,
  boost: { ...DEFAULT_BOOST },
  ignore: [],
  extensions: ['.md'],
  output: 'text',
  cache_dir: '.mdsearch',
};

/**
 * Try to read and parse a config file at a given directory.
 * Returns the parsed object or null if not found / invalid.
 */
function tryLoadConfig(dir) {
  const filePath = join(dir, CONFIG_FILENAME);
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Warning: could not parse ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Load config by checking target folder then cwd.
 * Returns merged config (defaults + file values).
 */
export function loadConfig(targetFolder) {
  const targetDir = resolve(targetFolder || '.');
  const cwd = resolve('.');

  // Try target folder first, then cwd if different
  let fileConfig = tryLoadConfig(targetDir);
  if (!fileConfig && targetDir !== cwd) {
    fileConfig = tryLoadConfig(cwd);
  }

  if (!fileConfig) return { ...DEFAULTS, boost: { ...DEFAULTS.boost } };

  // Merge: fileConfig overrides defaults
  const merged = { ...DEFAULTS };

  if (fileConfig.search_dir != null) merged.search_dir = fileConfig.search_dir;
  if (fileConfig.context != null) merged.context = fileConfig.context;
  if (fileConfig.limit != null) merged.limit = fileConfig.limit;
  if (fileConfig.fuzzy != null) merged.fuzzy = fileConfig.fuzzy;
  if (fileConfig.output != null) merged.output = fileConfig.output;
  if (fileConfig.cache_dir != null) merged.cache_dir = fileConfig.cache_dir;
  if (Array.isArray(fileConfig.ignore)) merged.ignore = fileConfig.ignore;
  if (Array.isArray(fileConfig.extensions)) merged.extensions = fileConfig.extensions;

  // Boost: partial override allowed
  merged.boost = { ...DEFAULTS.boost };
  if (fileConfig.boost) {
    if (fileConfig.boost.title != null) merged.boost.title = fileConfig.boost.title;
    if (fileConfig.boost.headings != null) merged.boost.headings = fileConfig.boost.headings;
    if (fileConfig.boost.text != null) merged.boost.text = fileConfig.boost.text;
    if (fileConfig.boost.date != null) merged.boost.date = fileConfig.boost.date;
  }

  return merged;
}
