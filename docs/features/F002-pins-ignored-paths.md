# F002 — Pinned projects & ignored paths

> Adopted 27 Nov 2026 from README.md + `index.js`. Status: **Done** (shipped in 2dc53b5 initial release).

## Why
Bulk cleaning must never break the projects the developer is actively working on, and some trees (archives) should never be scanned at all.

## What it does
- Config in `~/.devclean.json`: `{ pinnedProjects: string[], ignoredPaths: string[] }` (`loadConfig`/`saveConfig`).
- **Pinned project**: its `node_modules` is marked protected and is never deleted — not in `--yes` mode and not offered as safe. All cache types inside it (`.next`, `.turbo/cache`, …) are still cleaned.
- **Ignored path**: the scan skips it completely.
- `devclean [path] --pins` / `-p`: interactive list to pin/unpin projects under the root (`managePins`).
- The header shows how many projects are pinned and how many paths are ignored.

## Reuse
Discovery check: local JSON config file, no cross-cutting capability. `@broberg/config` targets service config/env, not a user's CLI dotfile — not applicable.

## Stories
- **F002.1** — Pinned projects protect node_modules in every delete mode.
- **F002.2** — Ignored paths are skipped by the scan.
- **F002.3** — `--pins` interactive pin management.
