# mdsearch — CLI de recherche plein texte pour fichiers Markdown

Moteur de recherche full-text local basé sur [MiniSearch](https://github.com/lucaong/minisearch). Indexation automatique, recherche floue, snippets contextuels, formatage LLM.

## Installation

```bash
npm install
```

## Utilisation

```bash
node search-md.mjs <dossier> "<requête>" [options]
```

L'index se construit automatiquement au premier lancement (cache dans `.mdsearch/`).

## Toutes les commandes — copier/coller

```bash
# ── SIMPLE ──
node search-md.mjs docs "minisearrch"                                   # fuzzy=0.2 (défaut), trouve "minisearch"
node search-md.mjs docs "minisearrch" --no-fuzzy                         # exact, ne trouve pas la faute
node search-md.mjs docs "minisearch" --fuzzy 0.4                         # fuzzy plus large

# ── BOOST ──
node search-md.mjs docs "terme"                                          # boost: title=3, headings=2, text=1
node search-md.mjs docs "terme" --boost-title 5 --boost-headings 3 --boost-text 1
node search-md.mjs docs "terme" --boost-title 1 --boost-headings 1 --boost-text 1  # égal

# ── CONTEXTE / LIMITE ──
node search-md.mjs docs "terme" --limit 5
node search-md.mjs docs "terme" --context 0
node search-md.mjs docs "terme" --context 4

# ── FORMAT DE SORTIE ──
node search-md.mjs docs "terme"                                          # lisible
node search-md.mjs docs "terme" --json                                   # JSON
node search-md.mjs docs "terme" --context 4 --llm-context                # compact LLM

# ── PRÉFIXE ──
node search-md.mjs docs "minis" --prefix

# ── CACHE / INDEX ──
node index-md.mjs ~/mes-notes                                            # pré-construire
node index-md.mjs ~/mes-notes --cache-dir .moncache
node search-md.mjs ~/mes-notes "minisearch"                              # utilise le cache
node search-md.mjs ~/mes-notes "terme" --reindex                         # force reconstruction
node search-md.mjs ~/mes-notes "terme" --cache-dir .moncache

# ── LLM-READY ──
node search-md.mjs ~/mes-notes "PI agent shell injection" --context 4 --limit 3 --llm-context
```

## Structure du cache

Le dossier `.mdsearch/` contient :

- `index.json` — l'index MiniSearch sérialisé
- `meta.json` — signature (nombre de fichiers + mtime max), mapping id → chemin absolu

Si la signature change (fichier ajouté/supprimé/modifié), `search-md.mjs` le détecte et ré-indexe automatiquement.

## Dépendances

- [Node.js](https://nodejs.org/) ≥ 18
- [minisearch](https://github.com/lucaong/minisearch) — seule dépendance npm
