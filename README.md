# mdsearch — Fast full-text search for Markdown knowledge bases

Local full-text search CLI for Markdown knowledge bases, Obsidian vaults, and note collections. Powered by [MiniSearch](https://github.com/lucaong/minisearch), with automatic indexing, fuzzy search, contextual snippets with line numbers, and LLM-ready output.

## LLM-ready workflows

mdsearch helps AI tools and LLM workflows retrieve relevant context from Markdown knowledge bases.
Search results are available in structured formats designed for AI agents, automation, and context retrieval. 

Learn more about the mdsearch skill:
https://github.com/onigetoc/mdsearch-skill

## Version, Help & Listing

```bash
mdsearch --version
mdsearch --help
mdsearch --list                # Lists all indexed files (auto-builds index if missing)
mdsearch --list --reindex      # Forces re-indexing before listing
```

## Installation

```bash
npm install
```

Or from npm:

```bash
npm install -g mdsearch-tool
```

## Usage

```bash
npx mdsearch "<query>" [<folder>] [options]

# or locally:
node src/search-md.mjs "<query>" [<folder>] [options]
```

Folder defaults to the current directory if omitted. The index is auto-built on first run (cache in `.mdsearch/`).

## All commands — copy/paste

```bash
# ── SIMPLE ──
mdsearch "minisearrch" notes-test                                # fuzzy=0.2 (default), finds "minisearch"
mdsearch "minisearrch" notes-test --no-fuzzy                      # exact only, won't find the typo
mdsearch "minisearch" notes-test --fuzzy 0.4                      # wider fuzzy

# ── BOOST ──
mdsearch "term" notes-test                                        # boost: title=3, headings=2, text=1
mdsearch "term" notes-test --boost-title 5 --boost-headings 3 --boost-text 1
mdsearch "term" notes-test --boost-title 1 --boost-headings 1 --boost-text 1

# ── CONTEXT / LIMIT ──
mdsearch "term" notes-test --limit 5
mdsearch "term" notes-test --context 0
mdsearch "term" notes-test --context 4

# ── OUTPUT FORMAT ──
mdsearch "term" notes-test                                         # human-readable
mdsearch "term" notes-test --json                                  # JSON with normalized scores + line
mdsearch "term" notes-test --context 4 --llm-context               # compact for LLM prompts

# ── PREFIX ──
mdsearch "minis" notes-test --prefix

# ── CACHE / INDEX ──
mdindex ~/my-notes                                                 # pre-build index
mdindex ~/my-notes --cache-dir .mycache
mdsearch "minisearch" ~/my-notes                                   # uses cache
mdsearch "term" ~/my-notes --reindex                               # force rebuild
mdsearch "term" ~/my-notes --cache-dir .mycache

# ── LLM-READY ──
mdsearch "PI agent shell injection" ~/my-notes --context 4 --limit 3 --llm-context
```

## Local development (without global install)

```bash
# ── SIMPLE ──
node src/search-md.mjs "minisearrch" notes-test                    # fuzzy=0.2 (default)
node src/search-md.mjs "minisearrch" notes-test --no-fuzzy         # exact only
node src/search-md.mjs "minisearch" notes-test --fuzzy 0.4         # wider fuzzy

# ── BOOST ──
node src/search-md.mjs "term" notes-test                           # boost: title=3, headings=2, text=1
node src/search-md.mjs "term" notes-test --boost-title 5 --boost-headings 3 --boost-text 1
node src/search-md.mjs "term" notes-test --boost-title 1 --boost-headings 1 --boost-text 1

# ── CONTEXT / LIMIT ──
node src/search-md.mjs "term" notes-test --limit 5
node src/search-md.mjs "term" notes-test --context 0
node src/search-md.mjs "term" notes-test --context 4

# ── OUTPUT FORMAT ──
node src/search-md.mjs "term" notes-test                           # human-readable
node src/search-md.mjs "term" notes-test --json                    # JSON
node src/search-md.mjs "term" notes-test --context 4 --llm-context # compact LLM

# ── PREFIX ──
node src/search-md.mjs "minis" notes-test --prefix

# ── CACHE / INDEX ──
node src/index-md.mjs ~/my-notes                                   # pre-build index
node src/index-md.mjs ~/my-notes --cache-dir .mycache
node src/search-md.mjs "minisearch" ~/my-notes                     # uses cache
node src/search-md.mjs "term" ~/my-notes --reindex                 # force rebuild
node src/search-md.mjs "term" ~/my-notes --cache-dir .mycache

# ── LLM-READY ──
node src/search-md.mjs "PI agent shell injection" ~/my-notes --context 4 --limit 3 --llm-context
```

## Cache structure

`.mdsearch/` contains:

- `index.json` — serialized MiniSearch index
- `meta.json` — folder signature (file count + max mtime), id → absolute path mapping

If the signature changes (file added/removed/modified), `search-md.mjs` detects it and re-indexes automatically.

## Output formats

All formats include line numbers and normalized scores (0.00 — 1.00).

| Mode | Example |
|---|---|
| Terminal | `line 42: → matching content` with highlighted match line |
| JSON | `{ "path": "...", "line": 42, "score": 0.92, "snippet": "..." }` |
| LLM context | `Confidence: 0.92` for each result, clean body without markers |

## Skills

mdsearch supports reusable skills to extend and automate search workflows.

A skill defines a custom workflow for processing search results, generating summaries, extracting insights, or preparing content for AI-powered workflows.

### Available skills

* **Summarize** — Generate concise summaries from indexed Markdown content.
* More skills coming soon.

Learn more about skills:

https://github.com/onigetoc/mdsearch-skills


## Dependencies

- [Node.js](https://nodejs.org/) ≥ 18
- [minisearch](https://github.com/lucaong/minisearch) — only npm dependency

## Possible improvements

- **Tag filtering** — `mdsearch "claude" --tag "video"` to filter by front-matter tags
- **Multi-term** — `mdsearch "claude archon" --and` (results containing all terms)
- **Stats mode** — `mdsearch --stats` : file count, estimated tokens, cache size
- **Markdown export** — `--export` generates a `.md` file with formatted results
- **Shell completions** — tab completion for zsh/bash/powershell
- **Watch mode** — `--watch` monitors files and re-indexes on change
