# mdsearch - Fast full-text search for Markdown knowledge bases

Local full-text search CLI for Markdown knowledge bases, Obsidian vaults, and note collections. Powered by [MiniSearch](https://github.com/lucaong/minisearch), with automatic indexing, fuzzy search, contextual snippets with line numbers, and LLM-ready output.

## LLM-ready workflows

mdsearch helps AI tools and LLM workflows retrieve relevant context from Markdown knowledge bases. Search results are available in structured formats designed for AI agents, automation, and context retrieval.

For maximum token efficiency and streamlined context retrieval, we recommend using the dedicated **mdsearch skill** which provides automated, ready-to-use workflows for your LLM agents:

https://github.com/onigetoc/mdsearch-skill

## Installation

### Global installation (recommended)

```bash
npm install -g @onigetoc/mdsearch
```

After global install, use `mdsearch` directly (no `npx`):

```bash
mdsearch "<query>"              # search current directory
mdsearch "<query>" <folder>     # search a specific folder
```

### Run without installation (npx)

```bash
npx @onigetoc/mdsearch "<query>" [<folder>]
```

Folder defaults to the current directory if omitted. The index is auto-built on first run (cache in `.mdsearch/`).

### Local dev test

```bash
node src/search-md.mjs "<query>"          # test without installing
```

## Examples

```bash
# SIMPLE
mdsearch "karpathy llm wiki"                               # current dir, fuzzy=0.2 (default)
mdsearch "karpathy llm wiki" notes-test                    # specific folder
mdsearch "term" --no-fuzzy                                 # exact only
mdsearch "term" --fuzzy 0.4                                # wider fuzzy

# BOOST
mdsearch "term"                                            # boost: title=3, headings=2, text=1
mdsearch "term" --boost-title 5 --boost-headings 3 --boost-text 1

# CONTEXT / LIMIT
mdsearch "term" --limit 5
mdsearch "term" --context 0                                # no snippet
mdsearch "term" --context 4

# OUTPUT FORMAT
mdsearch "term"                                            # human-readable
mdsearch "term" --json                                     # JSON with normalized scores + line
mdsearch "term" --context 4 --llm-context                  # compact for LLM prompts

# PREFIX, PHRASE & AND
mdsearch "minis" --prefix
mdsearch "karpathy llm" --phrase                           # exact phrase (sequence of terms)
mdsearch "karpathy llm" --and                              # require all terms (default: OR)

# CACHE / INDEX
mdindex ~/my-notes                                         # pre-build index
mdindex ~/my-notes --cache-dir .mycache
mdsearch "term" --reindex                                  # force rebuild
mdsearch "term" ~/my-notes --cache-dir .mycache

# VERSION / HELP / LIST
mdsearch --version
mdsearch --help
mdsearch --list                                            # list indexed files (auto-build if missing)
mdsearch --list --reindex                                  # force re-index before listing
```

## Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--fuzzy` | number | `0.2` | Fuzzy matching factor (0 = exact, 1 = very fuzzy). Use `--no-fuzzy` to disable. |
| `--prefix` | boolean | `false` | Enable prefix search (match term prefixes) |
| `--phrase` | boolean | `false` | Exact phrase search (sequence of terms in order) |
| `--and` | boolean | `false` | Require all terms (default is OR — any term matches) |
| `--boost-title` | number | `3` | Weight multiplier for matches in document title |
| `--boost-headings` | number | `2` | Weight multiplier for matches in headings |
| `--boost-text` | number | `1` | Weight multiplier for matches in body text |
| `--limit` | number | `10` | Maximum number of results to return |
| `--context` | number | `2` | Lines of context before/after match (0 = snippet disabled) |
| `--json` | boolean | `false` | Output results as JSON |
| `--llm-context` | boolean | `false` | Compact LLM-friendly output format |
| `--reindex` | boolean | `false` | Force rebuild the search index |
| `--cache-dir` | string | `.mdsearch` | Custom cache directory name |
| `--list` | boolean | `false` | List all indexed files |
| `--version` | boolean | `false` | Show version number |
| `--help` | boolean | `false` | Show help message |

## Cache structure

`.mdsearch/` contains:

- `index.json` - serialized MiniSearch index
- `meta.json` - folder signature (file count + max mtime), id → absolute path mapping

If the signature changes (file added/removed/modified), `search-md.mjs` detects it and re-indexes automatically.

## Output formats

All formats include line numbers and normalized scores (0.00 - 1.00).

| Mode | Example |
|------|---------|
| Terminal | `line 42: → matching content` with highlighted match line |
| JSON | `{ "path": "...", "line": 42, "score": 0.92, "snippet": "..." }` |
| LLM context | `Confidence: 0.92` for each result, clean body without markers |