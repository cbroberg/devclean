# devclean

Interactive CLI to reclaim disk space from dev project clutter — `node_modules`, `.next`, `.turbo/cache`, Android/iOS build artifacts, and more.

## Install

```bash
npm install -g .
# or from the repo:
npm install -g github:cbroberg/devclean
```

## Usage

```bash
# Interactive mode — scan and choose what to delete
devclean /path/to/projects

# List only, no deletion
devclean /path/to/projects --list

# Delete all safe cache non-interactively (respects pinned projects)
devclean /path/to/projects --yes

# Manage pinned projects
devclean /path/to/projects --pins
```

## What it finds

| Type | Folder / Path | Reinstall |
|------|--------------|-----------|
| Next.js build cache | `.next` | `npm run build` |
| Turborepo cache | `.turbo/cache` | next build |
| General cache | `.cache` | automatic |
| Build output | `dist`, `out` | `npm run build` |
| NPM packages | `node_modules` | `npm install` |
| pnpm monorepo packages | `node_modules` | `pnpm install` |
| iOS build artifacts | `DerivedData` | Xcode rebuild |
| Android build artifacts | `android/app/build`, `android/build` | Gradle rebuild |
| Python cache | `__pycache__`, `.pytest_cache` | automatic |
| Nuxt/Parcel/Vite/SvelteKit cache | various | automatic |

`node_modules` is marked ⚠ as it requires reinstall. All other types are safe to delete and regenerate automatically.

## Pinned projects

Projects you're actively working on can be **pinned** — their `node_modules` will never be deleted, even in bulk-clean mode. All cache types (`.next`, `.turbo/cache`, etc.) are still cleaned.

Config is stored in `~/.devclean.json`:

```json
{
  "pinnedProjects": [
    "/path/to/my-active-project"
  ],
  "ignoredPaths": [
    "/path/to/archived-projects"
  ]
}
```

## macOS note

Uses `find -depth -delete` instead of `rm -rf` for robustness with APFS and Spotlight indexing.
