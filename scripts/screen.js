#!/usr/bin/env node
// make.fun autonomous bounty hunter — 5-min screening loop
// Polls GET /api/competitions every 5 minutes for FREE bounties.
// Skips paid bounties (notify user), skips human-only bounties (report user).
// For free + auto-doable bounties: proceeds to build/submit.
//
// Identity (locked):
//   Handle: bebby
//   Account ID: 01a1ff66-6eae-7209-80b8-72ed5a5c3d87
//   Wallet: N8tyhYhsbCaFyC2kMp1RCjKnfKAxoobUy8AUc1oFFrt

import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.MAKEFUN_API_KEY || 'af_KgfKeUcrWkFwEpgvlOWQBfRrCJRtxmPiwDFfnisnnhCVBAejSnSrFgeLvvLrUxQT';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STATE_FILE = path.join(process.cwd(), '.hunter-state.json');
const LOG_FILE = path.join(process.cwd(), '.hunter-log.txt');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { seen: [], submitted: [], skipped: [], paid: [], human: [] };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchCompetitions() {
  const res = await fetch('https://make.fun/api/competitions?limit=200', {
    headers: { 'x-api-key': API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET /api/competitions failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchHeartbeat() {
  try {
    const res = await fetch('https://make.fun/api/agents/me', {
      headers: { 'x-api-key': API_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function isFree(c) {
  return c.entry_fee === null || c.entryFeesUsd === '0.00' || c.entry_fee === 0;
}

function isOpen(c) {
  const now = new Date().toISOString();
  return c.deadline && c.deadline > now;
}

function isHumanOnly(c) {
  const skills = (c.skills || []).join(' ').toLowerCase();
  const category = (c.category || '').toLowerCase();
  const text = `${skills} ${category} ${(c.title || '').toLowerCase()} ${(c.description || '').toLowerCase()}`;
  const humanSignals = ['youtube', 'tiktok', 'roblox', 'x.com', 'twitter', 'post on x', 'publish on youtube', 'publish on roblox'];
  return humanSignals.some((s) => text.includes(s));
}

function isAutoDoable(c) {
  // Free, open, not human-only, no unmet prerequisites we can't check
  return isFree(c) && isOpen(c) && !isHumanOnly(c);
}

async function screen() {
  const state = readState();
  const now = new Date().toISOString();
  log('=== Screening cycle ===');

  // Heartbeat check
  const hb = await fetchHeartbeat();
  if (hb) {
    log(`Heartbeat: handle=${hb.handle || '?'} open_competitions=${hb.open_competitions ?? '?'} entries=${hb.entries ?? '?'} prizes=${hb.prizes ?? '?'} poll_after=${hb.poll_after_seconds ?? '?'}s`);
    writeState({ ...state, heartbeat: hb });
  }

  let data;
  try {
    data = await fetchCompetitions();
  } catch (e) {
    log(`ERROR: ${e.message}`);
    return;
  }

  const items = data.items || data || [];
  log(`Found ${items.length} competitions`);

  const newFree = [];
  const newPaid = [];
  const newHuman = [];

  for (const c of items) {
    const slug = c.slug || c.id;
    if (state.seen.includes(slug)) continue;
    state.seen.push(slug);

    if (!isOpen(c)) {
      log(`SKIP (closed): ${slug} deadline=${c.deadline}`);
      continue;
    }

    if (isHumanOnly(c)) {
      newHuman.push(c);
      state.human.push({ slug, title: c.title, reward: c.rewardAmount });
      log(`HUMAN-ONLY: ${slug} — report to user`);
      continue;
    }

    if (!isFree(c)) {
      newPaid.push(c);
      state.paid.push({ slug, title: c.title, fee: c.entry_fee });
      log(`PAID: ${slug} — notify user (fee: ${c.entry_fee})`);
      continue;
    }

    newFree.push(c);
    log(`FREE + AUTO-DOABLE: ${slug} reward=${c.rewardAmount} deadline=${c.deadline}`);
  }

  // Write updated state
  writeState(state);

  // Summary
  log(`=== Summary: ${newFree.length} new free, ${newPaid.length} new paid, ${newHuman.length} new human-only ===`);

  // For each new free bounty, proceed to build/submit
  for (const c of newFree) {
    state.submitted.push({ slug: c.slug || c.id, title: c.title, at: now });
    log(`AUTO-BUILD+SUBMIT: ${c.slug || c.id}`);
    // TODO: download kit, build main.ts, submit — implement next
  }

  writeState(state);
  log(`Next screen in ${POLL_INTERVAL_MS / 60000} minutes`);
}

async function main() {
  await screen();
  // If run as a loop (not one-shot), set interval
  if (process.env.HUNTER_LOOP === '1') {
    setInterval(screen, POLL_INTERVAL_MS);
  }
}

main().catch((e) => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
