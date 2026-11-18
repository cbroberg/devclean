// Find og slet macOS-skærmbilleder ("Screenshot 2026-11-12 at 15.48.23.png",
// "Skærmbillede 2026-11-12 kl. 15.48.23.png", "Screen Shot …") på hele disken.
//
// Sikkerhed — hvad der ALDRIG slettes:
//   - filer der er yngre end KEEP_MS (ejeren bruger dem til at sende til agenter)
//   - alt under en mappe hvis navn indeholder "do not delete"
//   - alt inde i et git-repo (skærmbilleder dér er dokumentation/evidens)
//   - iCloud / CloudStorage / Photos-biblioteket
// Kun filnavnet afgør om det er et skærmbillede — ikke Spotlights
// kMDItemIsScreenCapture, som også markerer App Store-billeder i repoerne.
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { homedir, tmpdir } from 'os';
import path from 'path';

export const KEEP_MS = 24 * 60 * 60 * 1000;

const NAME_RE =
  /^(Screen ?[Ss]hot|Skærmbillede) \d{4}-\d{2}-\d{2} (at|kl\.) \d{1,2}\.\d{2}\.\d{2}( \(\d+\))?\.(png|jpe?g|heic|tiff)$/;

export function isScreenshotName(name) {
  return NAME_RE.test(name.normalize('NFC'));
}

const PROTECTED_SEGMENTS = [
  path.join('Library', 'Mobile Documents'),
  path.join('Library', 'CloudStorage'),
  '.photoslibrary',
];

/** Grunden til at en sti er beskyttet, eller null hvis den må slettes. */
export function protectedReason(filePath, { now = Date.now(), mtimeMs, insideGitRepo } = {}) {
  if (/do not delete/i.test(path.dirname(filePath))) return 'DO NOT DELETE-mappe';
  if (PROTECTED_SEGMENTS.some((s) => filePath.includes(s))) return 'iCloud/Photos';
  if (insideGitRepo(filePath)) return 'inde i et git-repo';
  if (now - mtimeMs < KEEP_MS) return 'yngre end 1 dag';
  return null;
}

/** Ligger stien inde i et git-repo? Kigger op ad træet efter .git. */
export function makeGitChecker(stopAt = path.parse(homedir()).root) {
  const cache = new Map();
  return function insideGitRepo(filePath) {
    let dir = path.dirname(filePath);
    const seen = [];
    while (dir && dir !== stopAt && dir !== path.dirname(dir)) {
      if (cache.has(dir)) {
        const v = cache.get(dir);
        seen.forEach((d) => cache.set(d, v));
        return v;
      }
      seen.push(dir);
      if (existsSync(path.join(dir, '.git'))) {
        seen.forEach((d) => cache.set(d, true));
        return true;
      }
      dir = path.dirname(dir);
    }
    seen.forEach((d) => cache.set(d, false));
    return false;
  };
}

function spotlightCandidates() {
  // Navne-forespørgsel i Spotlight: rører ikke iCloud-filer (ingen download),
  // og er hurtig på en næsten fuld disk.
  const q =
    'kMDItemFSName == "Screenshot *"cd || kMDItemFSName == "Screen Shot *"cd || kMDItemFSName == "Skærmbillede *"cd';
  try {
    return execFileSync('mdfind', [q], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function tempCandidates() {
  // Skærmbilleder trukket fra den flydende miniature ligger i TemporaryItems,
  // som Spotlight ikke indekserer.
  const out = [];
  const root = path.join(tmpdir(), 'TemporaryItems');
  const walk = (dir, depth) => {
    let items;
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory() && depth < 3) walk(p, depth + 1);
      else if (it.isFile()) out.push(p);
    }
  };
  walk(root, 0);
  return out;
}

/** Find skærmbilleder. Returnerer { deletable, kept } med størrelse og årsag. */
export function findScreenshots({ now = Date.now() } = {}) {
  const insideGitRepo = makeGitChecker();
  const paths = new Set([...spotlightCandidates(), ...tempCandidates()]);
  const deletable = [];
  const kept = [];
  for (const p of paths) {
    if (!isScreenshotName(path.basename(p))) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue; // væk siden Spotlight indekserede den
    }
    if (!st.isFile()) continue;
    const reason = protectedReason(p, { now, mtimeMs: st.mtimeMs, insideGitRepo });
    const entry = { path: p, bytes: st.size, mtimeMs: st.mtimeMs };
    if (reason) kept.push({ ...entry, reason });
    else deletable.push(entry);
  }
  deletable.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return { deletable, kept };
}

export function deleteScreenshots(entries) {
  let freed = 0;
  let count = 0;
  for (const e of entries) {
    try {
      unlinkSync(e.path);
      freed += e.bytes;
      count++;
    } catch {
      // kan være flyttet/slettet imens — tælles ikke med
    }
  }
  return { count, freed };
}
