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

# EXTENSIONS
mdsearch "query" --ext .md --ext .mdx                      # search .md and .mdx files
mdsearch "query" --ext .txt                                # search only .txt files

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

### Local dev test only

```bash
node src/search-md.mjs "<query>"          # test without installing
```

## Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--no-fuzzy` | boolean | `false` | Disable fuzzy matching (exact search only) |
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
| `--ext` | string | `.md` | File extensions to index (repeatable: `--ext .md --ext .mdx`) |
| `--list` | boolean | `false` | List all indexed files |
| `--version` | boolean | `false` | Show version number |
| `--help` | boolean | `false` | Show help message |

## Configuration file (`mdsearch.json`) — optional

This is **entirely optional**. mdsearch works out of the box with sensible defaults and CLI flags. But if you want to avoid repeating the same flags every time, you can drop a `mdsearch.json` file at the root of your project, Obsidian vault, or documentation folder.

**Priority:** CLI flags always override `mdsearch.json` values. The config file just sets your defaults.

### Setup

Create a `mdsearch.json` file in the directory where you run `mdsearch`:

```json
{
  "search_dir": "my-docs",
  "context": 3,
  "limit": 10,
  "fuzzy": 0.2,
  "boost": {
    "title": 3,
    "headings": 2,
    "text": 1
  },
  "ignore": ["drafts", "archive/old"],
  "extensions": [".md", ".mdx"],
  "output": "text"
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `search_dir` | string | `.` | Folder to search (relative to `mdsearch.json` location) |
| `context` | number | `2` | Lines of context around matches in snippets |
| `limit` | number | `10` | Max results returned |
| `fuzzy` | number / `false` | `0.2` | Fuzzy tolerance (0 to 1), `false` to disable |
| `boost.title` | number | `3` | Weight for title matches |
| `boost.headings` | number | `2` | Weight for heading matches |
| `boost.text` | number | `1` | Weight for body text matches |
| `ignore` | string[] | `[]` | Folders/paths to exclude from indexing |
| `extensions` | string[] | `[".md"]` | File extensions to index |
| `output` | string | `"text"` | Default output format: `"text"`, `"json"`, or `"llm-context"` |
| `cache_dir` | string | `".mdsearch"` | Cache directory name |

### Use cases

**Obsidian vault** — search your personal notes without indexing drafts:

```json
{
  "search_dir": ".",
  "ignore": ["drafts", "templates", ".trash"],
  "extensions": [".md"],
  "context": 3
}
```

**Programming documentation** — search a docs folder with MDX support:

```json
{
  "search_dir": "docs",
  "extensions": [".md", ".mdx"],
  "limit": 5,
  "output": "json"
}
```

**AI/LLM knowledge base** — optimized for LLM context retrieval:

```json
{
  "search_dir": "knowledge-base",
  "context": 4,
  "limit": 3,
  "output": "llm-context",
  "boost": {
    "title": 5,
    "headings": 3,
    "text": 1
  }
}
```

> CLI flags **always** override `mdsearch.json` values. For example, `mdsearch "query" --limit 3` will use 3 even if the config says 10. Same for `--ext` which overrides `extensions`. Without a config file, mdsearch uses its built-in defaults — no setup required.

## Cache structure

`.mdsearch/` contains:

- `index.json` - serialized MiniSearch index
- `meta.json` - folder signature (file count + max mtime), id → absolute path mapping

If the signature changes (file added/removed/modified), `search-md.mjs` detects it and re-indexes automatically.

## Output formats

All formats include line numbers and normalized scores (0.00 - 1.00).

| Mode | Example |
|------|---------|
| Terminal | `<!-- METADATA: {"query":"...","execution_time_ms":145} -->` then human-readable results |
| JSON | `{ "query": "...", "execution_time_ms": 145, "total_results": 2, "results": [...] }` |
| LLM context | YAML frontmatter `---\nquery: "..."\nexecution_time_ms: 145\nformat: markdown\n---` then markdown blocks |

### Real JSON output example

```bash
# intentional misspelling ("karpaty" instead of "karpathy")
mdsearch "karpaty wiki" --json 
```

### Json final output

```json
{
  "query": "karpathy wiki",
  "execution_time_ms": 223,
  "total_results": 10,
  "results": [
    {
      "title": "karpathy's second brain: how i build it",
      "description": "100K people bookmarked Andrej Karpathy post. LLM Knowledge Bases — Something I'm finding very useful recently: using...",
      "path": "Obsidian-knowledge-base\\karpathy's second brain_ how to build it.md",
      "line": 4,
      "score": 1,
      "snippet": "line 4:   > An LLM wiki is a knowledge system where the LLM maintains structured wiki pages instead of re-searching raw documents on every question.\nline 5:   \nline 6: → ## What Is an LLM Wiki?\nline 7:   \nline 8:   New sources are compiled into durable markdown pages, cross-references are updated over time, and answers cite the wiki pages that already contain the synthesized knowledge. This skill gives you three operations: **Ingest** (collect + compile), **Query** (search + cite), and **Lint** (check integrity)."
    },
    {
      "title": "How the Open Knowledge Format can improve data sharing",
      "description": "Learn how the Open Knowledge Format helps secure data sharing and improves collaboration across teams with standardized documentation.",
      "path": "Obsidian-knowledge-base\\How the Open Knowledge Format (OKF) can improve data sharing Google Cloud Blog.md",
      "line": 20,
      "score": 0.45,
      "snippet": "line 18:   As foundation models continue to improve, the lack of relevant context often limits what they can do, especially as they are used to build agentic systems. While these models can help you write code, summarize documents, or analyze a dataset, they still need the right information to produce accurate and actionable results.\nline 19:   \nline 20: → That's why today, we're introducing the Open Knowledge Format (OKF), an open specification that formalizesthe [LLM-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern into a portable,interoperable format. This is a vendor-neutral, agent- and human-friendly standard for representing the metadata, context, and curated knowledge that modern AI systems need.\nline 21:   \nline 22:   As published, **OKF v0.1** represents knowledge as a directory of markdown files with YAML frontmatter, with a small set of agreed-upon conventions that let wikis written by different producers be consumed by different agents without translation."
    },
    ...
  ]
}
```