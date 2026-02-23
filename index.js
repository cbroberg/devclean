#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';
import { checkbox, select, confirm } from '@inquirer/prompts';
import Table from 'cli-table3';

// ─── Clutter definitions ─────────────────────────────────────────────────────

// Matches by folder NAME anywhere in the tree
const CLUTTER_BY_NAME = {
  '.next':          { label: 'Next.js build cache',  color: 'cyan',    safe: true  },
  '.cache':         { label: 'Generel cache',         color: 'yellow',  safe: true  },
  'node_modules':   { label: 'NPM pakker',            color: 'red',     safe: false },
  'dist':           { label: 'Build output',          color: 'magenta', safe: true  },
  'out':            { label: 'Next.js static export', color: 'cyan',    safe: true  },
  '.parcel-cache':  { label: 'Parcel cache',          color: 'yellow',  safe: true  },
  '.nuxt':          { label: 'Nuxt.js cache',         color: 'green',   safe: true  },
  '.svelte-kit':    { label: 'SvelteKit cache',       color: 'yellow',  safe: true  },
  '.vite':          { label: 'Vite cache',            color: 'yellow',  safe: true  },
  'DerivedData':    { label: 'iOS build artefakter',  color: 'gray',    safe: true  },
  '__pycache__':    { label: 'Python cache',          color: 'blue',    safe: true  },
  '.pytest_cache':  { label: 'Pytest cache',          color: 'blue',    safe: true  },
  '.gradle':        { label: 'Gradle cache',          color: 'green',   safe: true  },
};

// Matches by PATH SUFFIX — more surgical, avoids false positives
// Only the matched subdirectory is deleted, not the parent
const CLUTTER_BY_PATH = [
  { suffix: '.turbo/cache',        label: 'Turborepo cache',   color: 'yellow', safe: true },
  { suffix: 'android/app/build',   label: 'Android build',     color: 'gray',   safe: true },
  { suffix: 'android/build',       label: 'Android build',     color: 'gray',   safe: true },
];

// All known labels for the table type-color lookup
const ALL_TYPES = {
  ...CLUTTER_BY_NAME,
  ...Object.fromEntries(CLUTTER_BY_PATH.map(p => [p.suffix, p])),
};

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(homedir(), '.devclean.json');

const DEFAULT_CONFIG = {
  // Projekter du arbejder aktivt på - node_modules slettes ALDRIG her
  pinnedProjects: [],
  // Stier der helt ignoreres under scanning (f.eks. arkiverede projekter)
  ignoredPaths: [],
};

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    return { ...DEFAULT_CONFIG };
  }
  try {
    const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function isPinned(config, entryPath) {
  return config.pinnedProjects.some(p => entryPath.startsWith(p) || p.startsWith(entryPath));
}

function getPinnedProjectForPath(config, entryPath) {
  return config.pinnedProjects.find(p => entryPath.startsWith(p));
}

// ─── Hjælpefunktioner ────────────────────────────────────────────────────────

function getDirSizeBytes(dirPath) {
  try {
    const result = execSync(`du -sk "${dirPath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    const kb = parseInt(result.split('\t')[0], 10);
    return isNaN(kb) ? 0 : kb * 1024;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes >= 1e9) return chalk.red(`${(bytes / 1e9).toFixed(1)} GB`);
  if (bytes >= 1e6) return chalk.yellow(`${(bytes / 1e6).toFixed(0)} MB`);
  if (bytes >= 1e3) return chalk.gray(`${(bytes / 1e3).toFixed(0)} KB`);
  return chalk.gray(`${bytes} B`);
}

// Brug find -depth -delete (mere robust end rm -rf på APFS/Spotlight på macOS)
function deleteDirContents(dirPath, dryRun) {
  if (dryRun) {
    console.log(chalk.dim(`  [dry-run] Ville slette: ${dirPath}`));
    return true;
  }
  try {
    execSync(`find "${dirPath}" -depth -delete 2>/dev/null || rm -rf "${dirPath}"`, {
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    console.error(chalk.red(`  Fejl ved sletning af ${dirPath}: ${err.message}`));
    return false;
  }
}

// ─── Find clutter ─────────────────────────────────────────────────────────────

function findByName(rootPath, ignoredPaths) {
  const nameArgs = Object.keys(CLUTTER_BY_NAME)
    .map(n => `-name "${n}"`)
    .join(' -o ');
  const cmd = `find "${rootPath}" -type d \\( ${nameArgs} \\) -prune 2>/dev/null`;
  try {
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return output.trim().split('\n').filter(p =>
      p && !ignoredPaths.some(ig => p.startsWith(ig))
    ).map(p => ({ path: p, typeKey: path.basename(p), def: CLUTTER_BY_NAME[path.basename(p)] }));
  } catch {
    return [];
  }
}

function findByPath(rootPath, ignoredPaths) {
  const results = [];
  for (const entry of CLUTTER_BY_PATH) {
    const cmd = `find "${rootPath}" -type d -path "*/${entry.suffix}" 2>/dev/null`;
    try {
      const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const paths = output.trim().split('\n').filter(p =>
        p && !ignoredPaths.some(ig => p.startsWith(ig))
      );
      for (const p of paths) {
        results.push({ path: p, typeKey: entry.suffix, def: entry });
      }
    } catch {
      // ignorer
    }
  }
  return results;
}

function findPnpmRoots(rootPath) {
  try {
    const cmd = `find "${rootPath}" -maxdepth 4 -name "pnpm-lock.yaml" -not -path "*/node_modules/*" 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return new Set(output.trim().split('\n').filter(Boolean).map(p => path.dirname(p)));
  } catch {
    return new Set();
  }
}

function findProjectRoots(rootPath) {
  try {
    const cmd = `find "${rootPath}" -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return output.trim().split('\n').filter(Boolean).map(p => path.dirname(p));
  } catch {
    return [];
  }
}

function getProjectName(dirPath, rootPath) {
  const rel = path.relative(rootPath, dirPath);
  const parts = rel.split(path.sep);
  return parts.slice(0, -1).join('/') || '.';
}

// ─── Scanning ────────────────────────────────────────────────────────────────

async function scan(rootPath, config) {
  console.log(chalk.dim(`\nScanner ${rootPath} ...\n`));

  const ignored = config.ignoredPaths ?? [];
  const byName = findByName(rootPath, ignored);
  const byPath = findByPath(rootPath, ignored);
  const allDirs = [...byName, ...byPath];

  if (allDirs.length === 0) {
    console.log(chalk.green('Ingen clutter fundet!'));
    return [];
  }

  const spinner = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let si = 0;
  const iv = setInterval(() => {
    process.stdout.write(`\r${chalk.cyan(spinner[si++ % spinner.length])} Måler størrelser...`);
  }, 80);

  const pnpmRoots = findPnpmRoots(rootPath);

  const entries = allDirs.map(({ path: dirPath, typeKey, def }) => {
    const name = path.basename(dirPath);
    const bytes = getDirSizeBytes(dirPath);
    const project = getProjectName(dirPath, rootPath);
    const pinned = isPinned(config, dirPath);
    const protected_ = pinned && name === 'node_modules';
    const isPnpm = name === 'node_modules' &&
      [...pnpmRoots].some(root => dirPath.startsWith(root));

    return {
      path: dirPath,
      name,
      typeKey,
      label: isPnpm ? 'pnpm monorepo' : def.label,
      color: isPnpm ? 'magenta' : def.color,
      safe: def.safe,
      bytes,
      project,
      pinned,
      protected: protected_,
      isPnpm,
    };
  }).filter(e => e.bytes > 0);

  clearInterval(iv);
  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  // Fjern dubletter (android/build kan være indeholdt i android/app/build osv.)
  const seen = new Set();
  const deduped = entries.filter(e => {
    if (seen.has(e.path)) return false;
    seen.add(e.path);
    return true;
  });

  deduped.sort((a, b) => b.bytes - a.bytes);
  return deduped;
}

// ─── Visning ─────────────────────────────────────────────────────────────────

function printTable(entries) {
  const table = new Table({
    head: [chalk.bold('#'), chalk.bold('Størrelse'), chalk.bold('Type'), chalk.bold('Projekt / Sti'), chalk.bold('Status')],
    style: { head: [], border: ['dim'] },
    colWidths: [5, 12, 24, 55, 12],
  });

  let i = 1;
  for (const e of entries) {
    const typeColor = chalk[e.color] ?? chalk.white;
    const safeTag = (e.safe || e.isPnpm) ? '' : chalk.red(' ⚠');
    const status = e.protected
      ? chalk.green('📌 pinned')
      : e.isPnpm && !e.pinned ? chalk.magenta('⬡ pnpm') : '';

    table.push([
      chalk.dim(String(i++)),
      formatSize(e.bytes),
      typeColor(e.label) + safeTag,
      chalk.dim(e.project + '/') + chalk.bold(e.name),
      status,
    ]);
  }

  console.log(table.toString());

  const total = entries.reduce((s, e) => s + e.bytes, 0);
  const prot = entries.filter(e => e.protected).reduce((s, e) => s + e.bytes, 0);

  console.log(chalk.bold(`\n  Total clutter:     ${formatSize(total)}`));
  if (prot > 0) {
    console.log(chalk.green(`  Beskyttet (pinned): ${formatSize(prot)}`));
    console.log(chalk.yellow(`  Kan slettes:        ${formatSize(total - prot)}`));
  }
  console.log('');
}

function printPinnedList(config) {
  if (config.pinnedProjects.length === 0) {
    console.log(chalk.dim('  (ingen pinnede projekter)\n'));
    return;
  }
  for (const p of config.pinnedProjects) {
    const icon = existsSync(p) ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${p}`);
  }
  console.log('');
}

// ─── Pin management ──────────────────────────────────────────────────────────

async function managePins(rootPath, config) {
  console.log(chalk.bold('\n📌 Aktive projekter (node_modules beskyttes):\n'));
  printPinnedList(config);

  const action = await select({
    message: 'Hvad vil du gøre?',
    choices: [
      { name: '➕  Tilføj projekter fra ' + rootPath, value: 'add'    },
      { name: '➖  Fjern projekter fra listen',         value: 'remove' },
      { name: '↩   Tilbage',                           value: 'back'   },
    ],
  });

  if (action === 'back') return;

  if (action === 'add') {
    console.log(chalk.dim('\nFinder projekter...\n'));
    const roots = findProjectRoots(rootPath);
    const choices = roots.map(p => ({
      name: path.relative(rootPath, p),
      value: p,
      checked: config.pinnedProjects.includes(p),
    })).sort((a, b) => a.name.localeCompare(b.name));

    if (choices.length === 0) {
      console.log(chalk.yellow('Ingen projekter fundet.\n'));
      return;
    }

    const selected = await checkbox({
      message: 'Vælg aktive projekter (node_modules beskyttes mod sletning):',
      choices,
      pageSize: 25,
    });

    config.pinnedProjects = [
      ...config.pinnedProjects.filter(p => !roots.includes(p)),
      ...selected,
    ];
    saveConfig(config);
    console.log(chalk.green(`\n✓ Gemt ${selected.length} pinnede projekter → ${CONFIG_PATH}\n`));
  }

  if (action === 'remove') {
    if (config.pinnedProjects.length === 0) {
      console.log(chalk.yellow('Ingen pinnede projekter at fjerne.\n'));
      return;
    }
    const choices = config.pinnedProjects.map(p => ({ name: p, value: p, checked: false }));
    const toRemove = await checkbox({
      message: 'Vælg projekter der skal fjernes fra pin-listen:',
      choices,
    });
    config.pinnedProjects = config.pinnedProjects.filter(p => !toRemove.includes(p));
    saveConfig(config);
    console.log(chalk.green(`\n✓ Fjernet ${toRemove.length} projekter fra pin-listen\n`));
  }
}

// ─── Sletning ────────────────────────────────────────────────────────────────

async function runDelete(toDelete, dryRunForced = null) {
  if (toDelete.length === 0) {
    console.log(chalk.yellow('\nIntet valgt.\n'));
    return;
  }

  const totalBytes = toDelete.reduce((s, e) => s + e.bytes, 0);
  console.log(chalk.bold(`\nKlar til at slette ${toDelete.length} mapper (${formatSize(totalBytes)})\n`));

  const dryRun = dryRunForced !== null ? dryRunForced : await confirm({
    message: 'Kør som dry-run først? (anbefalet)',
    default: true,
  });

  if (!dryRun) {
    const sure = await confirm({
      message: chalk.red('Denne handling kan ikke fortrydes. Fortsæt?'),
      default: false,
    });
    if (!sure) {
      console.log(chalk.yellow('Annulleret.\n'));
      return;
    }
  }

  console.log('');
  let deleted = 0;
  let savedBytes = 0;

  for (const entry of toDelete) {
    const ok = deleteDirContents(entry.path, dryRun);
    if (ok) {
      deleted++;
      savedBytes += entry.bytes;
      if (!dryRun) console.log(chalk.green(`  ✓ ${entry.project}/${entry.name}`));
    }
  }

  const verb = dryRun ? 'Ville frigive' : 'Frigivet';
  console.log(chalk.bold.green(`\n${verb}: ${formatSize(savedBytes)} (${deleted} mapper)\n`));

  if (dryRun) {
    const goForIt = await confirm({ message: 'Kør nu for rigtig?', default: false });
    if (goForIt) {
      for (const entry of toDelete) {
        if (existsSync(entry.path)) {
          const ok = deleteDirContents(entry.path, false);
          if (ok) console.log(chalk.green(`  ✓ ${entry.project}/${entry.name}`));
        }
      }
      console.log(chalk.bold.green(`\nFrigivet: ${formatSize(savedBytes)}\n`));
    }
  }
}

// ─── Interaktivt flow ────────────────────────────────────────────────────────

async function interactiveClean(entries, config, rootPath) {
  const deletable = entries.filter(e => !e.protected);

  const action = await select({
    message: 'Hvad vil du gøre?',
    choices: [
      { name: '🧹  Vælg hvad der skal slettes (manuel)',         value: 'manual' },
      { name: '⚡  Slet ALT cache (safe types, respektér pins)', value: 'safe'   },
      { name: '💣  Slet ALT inkl. node_modules (respektér pins)',value: 'all'    },
      { name: '📌  Administrér aktive projekter (pin)',           value: 'pins'   },
      { name: '❌  Afslut',                                      value: 'exit'   },
    ],
  });

  if (action === 'exit') return;

  if (action === 'pins') {
    await managePins(rootPath, config);
    return;
  }

  let toDelete = [];

  if (action === 'safe') {
    toDelete = deletable.filter(e => e.safe);
  } else if (action === 'all') {
    const ok = await confirm({
      message: chalk.red(`Dette sletter ALLE node_modules (undtagen ${config.pinnedProjects.length} pinnede projekter). Er du sikker?`),
      default: false,
    });
    if (!ok) return;
    toDelete = deletable;
  } else if (action === 'manual') {
    const choices = entries.map((e, i) => ({
      name: `${String(formatSize(e.bytes)).padEnd(18)} ${e.project}/${chalk.bold(e.name)}${e.protected ? chalk.green(' 📌') : ''}`,
      value: i,
      checked: e.safe && !e.protected,
      disabled: e.protected ? '(pinned projekt)' : false,
    }));
    const selected = await checkbox({
      message: 'Vælg hvad der skal slettes (space = toggle, enter = bekræft):',
      choices,
      pageSize: 20,
    });
    toDelete = selected.map(i => entries[i]);
  }

  await runDelete(toDelete);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const rootPath = path.resolve(args.find(a => !a.startsWith('-')) ?? process.cwd());
  const listOnly = args.includes('--list') || args.includes('-l');
  const pinsOnly = args.includes('--pins') || args.includes('-p');
  const yesCache = args.includes('--yes')  || args.includes('-y');

  if (!existsSync(rootPath)) {
    console.error(chalk.red(`Stien findes ikke: ${rootPath}`));
    process.exit(1);
  }

  const config = loadConfig();

  console.log(chalk.bold.cyan('\n╔══════════════════════════════╗'));
  console.log(chalk.bold.cyan('║  devclean — dev folder ryd  ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════╝\n'));
  console.log(chalk.dim(`  Root:    ${rootPath}`));
  console.log(chalk.dim(`  Config:  ${CONFIG_PATH}`));
  if (config.pinnedProjects.length > 0)
    console.log(chalk.green(`  Pinned:  ${config.pinnedProjects.length} aktive projekter (node_modules beskyttes)`));
  if ((config.ignoredPaths ?? []).length > 0)
    console.log(chalk.dim(`  Ignored: ${config.ignoredPaths.length} stier springes over`));
  console.log('');

  if (pinsOnly) {
    await managePins(rootPath, config);
    return;
  }

  const entries = await scan(rootPath, config);
  if (entries.length === 0) return;

  printTable(entries);

  if (yesCache) {
    const toDelete = entries.filter(e => e.safe && !e.protected);
    const totalBytes = toDelete.reduce((s, e) => s + e.bytes, 0);
    console.log(chalk.bold(`Sletter ${toDelete.length} cache-mapper (${formatSize(totalBytes)})...\n`));
    let saved = 0;
    for (const entry of toDelete) {
      const ok = deleteDirContents(entry.path, false);
      if (ok) {
        saved += entry.bytes;
        console.log(chalk.green(`  ✓ ${entry.project}/${entry.name}`));
      }
    }
    console.log(chalk.bold.green(`\nFrigivet: ${formatSize(saved)} (${toDelete.length} mapper)\n`));
    return;
  }

  if (!listOnly) {
    await interactiveClean(entries, config, rootPath);
  }
}

main().catch(err => {
  console.error(chalk.red('\nFejl: ' + err.message));
  process.exit(1);
});
