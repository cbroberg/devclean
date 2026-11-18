import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { isScreenshotName, protectedReason, makeGitChecker, KEEP_MS } from './screenshots.js';

test('genkender alle datoer og begge sprog', () => {
  for (const n of [
    'Screenshot 2026-11-12 at 15.48.23.png',
    'Screenshot 2024-01-03 at 9.05.01.png',
    'Screenshot 2026-11-12 at 15.48.23 (2).png',
    'Skærmbillede 2026-11-12 kl. 15.48.23.png',
    'Screen Shot 2020-05-01 at 10.00.00.jpg',
  ]) assert.equal(isScreenshotName(n), true, n);
});

test('rammer ikke andre filer, også selvom de ligner', () => {
  for (const n of [
    '06_profil.png',
    '1-forside.png',
    'Screenshot.png',
    'Screenshot 2026-11-12 at 15.48.23.png.txt',
    'my Screenshot 2026-11-12 at 15.48.23.png',
    'Screen Recording 2026-11-12 at 15.48.23.mov',
  ]) assert.equal(isScreenshotName(n), false, n);
});

const now = Date.UTC(2026, 10, 18, 12);
const old = now - 3 * KEEP_MS;
const noGit = () => false;

test('gammelt skærmbillede uden for repo må slettes', () => {
  assert.equal(protectedReason('/Users/x/Downloads/Screenshot 2026-11-01 at 1.00.00.png', { now, mtimeMs: old, insideGitRepo: noGit }), null);
});

test('yngre end 1 dag beholdes — grænsen ligger præcis ved 24 timer', () => {
  const p = '/Users/x/Downloads/Screenshot.png';
  assert.equal(protectedReason(p, { now, mtimeMs: now - KEEP_MS + 1000, insideGitRepo: noGit }), 'yngre end 1 dag');
  assert.equal(protectedReason(p, { now, mtimeMs: now - KEEP_MS - 1000, insideGitRepo: noGit }), null);
});

test('DO NOT DELETE-mapper beholdes uanset store/små bogstaver og dybde', () => {
  for (const p of [
    '/Users/x/Downloads/DO NOT DELETE/Screenshot 2026-11-01 at 1.00.00.png',
    '/Users/x/Downloads/Do Not Delete - kunde/sub/Screenshot 2026-11-01 at 1.00.00.png',
  ]) assert.equal(protectedReason(p, { now, mtimeMs: old, insideGitRepo: noGit }), 'DO NOT DELETE-mappe', p);
});

test('iCloud og Photos beholdes', () => {
  for (const p of [
    '/Users/x/Library/Mobile Documents/com~apple~CloudDocs/Screenshot 2026-11-01 at 1.00.00.png',
    '/Users/x/Library/CloudStorage/GoogleDrive/Screenshot 2026-11-01 at 1.00.00.png',
    '/Users/x/Pictures/Photos Library.photoslibrary/originals/Screenshot 2026-11-01 at 1.00.00.png',
  ]) assert.equal(protectedReason(p, { now, mtimeMs: old, insideGitRepo: noGit }), 'iCloud/Photos', p);
});

test('git-repo: et skærmbillede dybt inde i et repo beholdes, uden for beholdes ikke', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'devclean-test-'));
  const repo = path.join(root, 'repo');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  mkdirSync(path.join(repo, 'docs', 'img'), { recursive: true });
  const inside = path.join(repo, 'docs', 'img', 'Screenshot 2026-11-01 at 1.00.00.png');
  const outside = path.join(root, 'Screenshot 2026-11-01 at 1.00.00.png');
  writeFileSync(inside, 'x');
  writeFileSync(outside, 'x');
  const check = makeGitChecker(path.parse(root).root);
  assert.equal(protectedReason(inside, { now, mtimeMs: old, insideGitRepo: check }), 'inde i et git-repo');
  assert.equal(protectedReason(outside, { now, mtimeMs: old, insideGitRepo: check }), null);
  // .git som FIL (worktree) tæller også
  const wt = path.join(root, 'wt');
  mkdirSync(wt);
  writeFileSync(path.join(wt, '.git'), 'gitdir: x');
  assert.equal(protectedReason(path.join(wt, 'Screenshot 2026-11-01 at 1.00.00.png'), { now, mtimeMs: old, insideGitRepo: check }), 'inde i et git-repo');
});
