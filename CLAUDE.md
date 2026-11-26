# devclean — operational schematics for cc

> This repo is onboarded into [cardmem](https://www.cardmem.com). This file is the operational layer cc reads on every session — conventions, reuse-first defaults, and the rules below. The live cardmem board + the plan-docs under `docs/features/` are the source of truth.

## Project layout

| Area | Path | Notes |
|---|---|---|
| CLI (dev clutter) | `index.js` | Entry/bin: arg parsing, scan, cache, pins, interactive + `--yes` delete, `update` |
| Screenshots | `screenshots.js` | `devclean screenshots` — find/delete macOS screenshots disk-wide with safety rules |
| Tests | `screenshots.test.js` | `node --test` suite for the screenshot rules |
| Plan-docs | `docs/features/` | `F<n>-<slug>.md`, written via cardmem |
| CI | `.github/workflows/` | Fleet secret + security gates (cardmem-owned) |

## Fleet rules (cardmem-owned)

@.claude/fleet.md
@.claude/decisions-index.md

