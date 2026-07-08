# mdsearch - Fast full-text search for Markdown knowledge bases

Local full-text search CLI for Markdown knowledge bases, Obsidian vaults, and note collections. Powered by [MiniSearch](https://github.com/lucaong/minisearch), with automatic indexing, fuzzy search, contextual snippets with line numbers, and LLM-ready output.

## LLM-ready workflows

mdsearch helps AI tools and LLM workflows retrieve relevant context from Markdown knowledge bases. Search results are available in structured formats designed for AI agents, automation, and context retrieval.

For maximum token efficiency and streamlined context retrieval, we recommend using the dedicated **mdsearch skill** which provides automated, ready-to-use workflows for your LLM agents:

https://github.com/onigetoc/mdsearch-skill

## Version, Help & Listing

```bash
npx @onigetoc/mdsearch --version
npx @onigetoc/mdsearch --help
npx @onigetoc/mdsearch --list                # Lists all indexed files (auto-builds index if missing)
npx @onigetoc/mdsearch --list --reindex      # Forces re-indexing before listing
```

## Installation

### Global installation (recommended)
To use `mdsearch` as a system-wide command:

```bash
npm install -g @onigetoc/mdsearch
```

### Local installation (in your project)
To install it as a development dependency:

```bash
npm install @onigetoc/mdsearch
```

### Run without installation (recommended)
Run it directly with `npx` to always ensure the latest version:

```bash
npx @onigetoc/mdsearch "<query>" [<folder>] [options]
```

Folder defaults to the current directory if omitted. The index is auto-built on first run (cache in `.mdsearch/`).

## All commands - copy/paste

```bash
# ── SIMPLE ──
npx @onigetoc/mdsearch "karpathy llM wiki" notes-test                                # fuzzy=0.2 (default), finds "karpathy llm wiki"
npx @onigetoc/mdsearch "term" notes-test --no-fuzzy                      # exact only, won't find the typo
npx @onigetoc/mdsearch "term" notes-test --fuzzy 0.4                      # wider fuzzy

# ── BOOST ──
npx @onigetoc/mdsearch "term" notes-test                                        # boost: title=3, headings=2, text=1
npx @onigetoc/mdsearch "term" notes-test --boost-title 5 --boost-headings 3 --boost-text 1
npx @onigetoc/mdsearch "term" notes-test --boost-title 1 --boost-headings 1 --boost-text 1

# ── CONTEXT / LIMIT ──
npx @onigetoc/mdsearch "term" notes-test --limit 5
npx @onigetoc/mdsearch "term" notes-test --context 0
npx @onigetoc/mdsearch "term" notes-test --context 4

# ── OUTPUT FORMAT ──
npx @onigetoc/mdsearch "term" notes-test                                         # human-readable
npx @onigetoc/mdsearch "term" notes-test --json                                  # JSON with normalized scores + line
npx @onigetoc/mdsearch "term" notes-test --context 4 --llm-context               # compact for LLM prompts

# ── PREFIX, PHRASE & AND ──
npx @onigetoc/mdsearch "minis" notes-test --prefix
npx @onigetoc/mdsearch "karpathy llm" notes-test --phrase       # exact phrase search (sequence of terms)
npx @onigetoc/mdsearch "karpathy llm" notes-test --and          # require all terms (default: OR)

# ── CACHE / INDEX ──
node src/index-md.mjs ~/my-notes                                     # pre-build index
node src/index-md.mjs ~/my-notes --cache-dir .mycache
npx @onigetoc/mdsearch "term" ~/my-notes                             # uses cache
npx @onigetoc/mdsearch "term" ~/my-notes --reindex                   # force rebuild
npx @onigetoc/mdsearch "term" ~/my-notes --cache-dir .mycache
```

## Cache structure

`.mdsearch/` contains:

- `index.json` - serialized MiniSearch/mdsearch index
- `meta.json` - folder signature (file count + max mtime), id → absolute path mapping

If the signature changes (file added/removed/modified), `search-md.mjs` detects it and re-indexes automatically.

## Output formats

All formats include line numbers and normalized scores (0.00 - 1.00).

| Mode | Example |
|---|---|
| Terminal | `line 42: → matching content` with highlighted match line |
| JSON | `{ "path": "...", "line": 42, "score": 0.92, "snippet": "..." }` |
| LLM context | `Confidence: 0.92` for each result, clean body without markers |
