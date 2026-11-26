# F003 — Screenshot cleanup (`devclean screenshots`)

> Adopted 27 Nov 2026 from `screenshots.js`, `screenshots.test.js` and commit 28068f6. Status: **Done**.

## Why
The owner takes many screenshots to send to agents. They pile up across Desktop, Downloads and temp dirs and are rarely needed after a day.

## What it does
- Candidates come from Spotlight (`mdfind`) plus temp dirs; a file counts only if its **name** matches macOS screenshot naming: `Screenshot|Screen Shot|Skærmbillede YYYY-MM-DD at|kl. H.MM.SS[ (n)].png|jpg|jpeg|heic|tiff` (NFC-normalised).
- Never deleted (`protectedReason`):
  - younger than `KEEP_MS` (24 h, exact boundary);
  - anywhere under a folder whose name contains "do not delete" (case-insensitive, any depth);
  - inside a git repo (screenshots there are documentation/evidence);
  - iCloud (`Library/Mobile Documents`), `Library/CloudStorage`, `.photoslibrary`.
- `devclean screenshots` lists deletable vs kept with sizes and asks before deleting; `--list` shows only, `--yes` deletes without asking.

## Reuse
Discovery check: local filesystem utility, no cross-cutting capability. Nothing in `@broberg/*` applies.

## Stories
- **F003.1** — Screenshot detection by filename (EN + DA).
- **F003.2** — Safety rules: age, do-not-delete, git repo, cloud/photos.
- **F003.3** — `devclean screenshots` command with `--list`/`--yes`.
