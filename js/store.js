// Shared in-memory state for the loaded diary files.
// The "current" slot is reused across sub-apps. Compare also has dedicated old/new slots.

import { DiaryParser } from './parser.js';

const state = {
  current: null, // { name, entries, loadedAt }
  oldFile: null,
  newFile: null,
  comparisons: null, // populated by the Compare view
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (e) {
      console.error('store listener error', e);
    }
  }
}

export async function loadFileInto(slot, file) {
  const text = await readFileAsText(file);
  const entries = DiaryParser.parseEntries(text);
  const record = {
    name: file.name,
    size: file.size,
    entries,
    loadedAt: new Date(),
  };
  if (slot === 'current') state.current = record;
  else if (slot === 'old') state.oldFile = record;
  else if (slot === 'new') state.newFile = record;
  emit();
  return record;
}

export function copyCurrentInto(slot) {
  if (!state.current) return null;
  // Reuse the parsed payload so we don't reparse a 10MB file unnecessarily
  const copy = { ...state.current };
  if (slot === 'old') state.oldFile = copy;
  else if (slot === 'new') state.newFile = copy;
  emit();
  return copy;
}

export function setComparisons(comparisons) {
  state.comparisons = comparisons;
  emit();
}

export function clearSlot(slot) {
  if (slot === 'current') state.current = null;
  else if (slot === 'old') state.oldFile = null;
  else if (slot === 'new') state.newFile = null;
  emit();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('読み込みに失敗しました'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file, 'utf-8');
  });
}
