# F001 — Dev-clutter scan & clean

> Adopted 27 Nov 2026 from README.md + `index.js`. Status: **Done** (shipped in 2dc53b5 initial release, cache in 03d1d18).

## Why
A developer's Mac fills up with regenerable build output and dependency folders spread over dozens of projects. devclean finds them in one pass and removes them without the user hunting folder by folder.

## What it does
- `devclean [path]` (default: cwd) walks the tree and matches clutter two ways:
  - **by folder name** anywhere: `.next`, `.cache`, `node_modules`, `dist`, `out`, `.parcel-cache`, `.nuxt`, `.svelte-kit`, `.vite`, `DerivedData`, `__pycache__`, `.pytest_cache`, `.gradle`;
  - **by path suffix** (surgical, only the subfolder): `.turbo/cache`, `android/app/build`, `android/build`.
- Every hit gets size, project name and a `safe` flag. `node_modules` is the only non-safe type (needs reinstall) and is marked ⚠.
- Prints a table (`cli-table3`) sorted by size.
- Modes: interactive checkbox selection (default), `--list`/`-l` (show only), `--yes`/`-y` (delete every safe, unprotected entry without prompts).
- Deletes the folder contents with `find -depth -delete` (robust on APFS + Spotlight).
- **Scan cache**: results stored per root in a cache file with a 1 h TTL; `--fresh`/`-f` bypasses it; a delete invalidates that root's cache.
- Missing path → red error, exit code 1.

## Non-goals
- No cloud/remote cleanup, no Docker/Homebrew caches (see the separate `disk-cleanup` skill for those).

## Reuse
Discovery check: devclean is a local CLI with no cross-cutting capability (no mail, auth, push, storage, LLM, cron or telemetry). Nothing in `@broberg/*` applies; build-local is correct.

## Stories
- **F001.1** — Detect clutter by name and path suffix, with size + safe flag.
- **F001.2** — Interactive, list-only and bulk (`--yes`) delete modes.
- **F001.3** — Scan cache with 1 h TTL and `--fresh`.
