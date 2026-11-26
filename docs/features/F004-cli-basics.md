# F004 — CLI basics: help, version, self-update

> Adopted 27 Nov 2026 from `index.js` and commits 07e58c5, 43e32ad. Status: **Done**.

## Why
A globally installed CLI needs to explain itself, report its version, and update without the user remembering the install source.

## What it does
- `devclean --help` / `-h`: Danish help text with usage, examples, all flags (`--list`, `--yes`, `--fresh`, `--pins`, `--version`, `--help`), the `update` and `screenshots` subcommands, and the `~/.devclean.json` keys.
- `devclean --version` / `-v`: prints `devclean v<version>`, version read from `package.json`.
- `devclean update`: `selfUpdate()` reinstalls globally from `github:cbroberg/devclean`.
- Header line `devclean vX.Y.Z` on every scan run.
- Install: `npm install -g github:cbroberg/devclean` (bin `devclean` → `index.js`).

## Reuse
Discovery check: no cross-cutting capability. Not applicable.

## Stories
- **F004.1** — `--help` and `--version`.
- **F004.2** — `devclean update` self-update from GitHub.
