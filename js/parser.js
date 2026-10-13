// Diary parsing and analysis logic.
// Mirrors the Swift implementation (DiaryParser / DiaryStatistics / DiaryViewModel) verbatim.

const TRIM_RE = /^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]+|[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]+$/g;

function trimWS(s) {
  return s.replace(TRIM_RE, '');
}

const _segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
  ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
  : null;

// Swift CharacterSet.whitespacesAndNewlines (including U+200B, excluding U+FEFF).
const BLANK_CHARACTER_RE = /^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]+$/u;

export function countDiaryCharacters(text) {
  if (!text) return 0;
  if (!_segmenter) {
    throw new Error('正確な文字数カウントには Intl.Segmenter 対応ブラウザが必要です。');
  }
  // Match Swift: segment the original text first, then skip whitespace-only clusters.
  // In particular, half-width kana plus dakuten/handakuten counts as one character.
  let count = 0;
  for (const { segment } of _segmenter.segment(text)) {
    if (!BLANK_CHARACTER_RE.test(segment)) count++;
  }
  return count;
}

export const DiaryParser = {
  parseEntries(rawText) {
    const trimmed = trimWS(rawText);
    if (!trimmed) return [];

    // Same pattern as Swift / Dart: '\n\s*\n(?=\d{4}/\d{2}/\d{2})'
    const splitter = /\n\s*\n(?=\d{4}\/\d{2}\/\d{2})/g;
    const parts = trimmed.split(splitter);

    const results = [];
    for (const part of parts) {
      const trimmedPart = trimWS(part);
      if (!trimmedPart) continue;

      const lines = trimmedPart.split(/\r?\n/);
      const firstLine = lines[0] ? trimWS(lines[0]) : '';
      if (!/^\d{4}\/\d{2}\/\d{2}$/.test(firstLine)) continue;

      const [yearStr, monthStr, dayStr] = firstLine.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) continue;

      const body = trimWS(lines.slice(1).join('\n'));
      const characterCount = countDiaryCharacters(body);

      // Mirror Swift: GMT-anchored date so y/m/d round-trip cleanly
      const date = new Date(Date.UTC(year, month - 1, day));

      results.push({ year, month, day, date, content: body, characterCount });
    }
    return results;
  },
};

export const DiaryStatistics = {
  totalCharacterCount(entries) {
    let s = 0;
    for (const e of entries) s += e.characterCount;
    return s;
  },

  makeDailyCSV(entries, { sortByCount = false } = {}) {
    const working = sortByCount
      ? [...entries].sort((a, b) => b.characterCount - a.characterCount)
      : entries;
    return working
      .map((e) => `${e.year},${e.month},${e.day},${e.characterCount}`)
      .join('\n');
  },

  monthlyTotals(entries) {
    const map = new Map();
    for (const e of entries) {
      const key = `${String(e.year).padStart(4, '0')}-${String(e.month).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + e.characterCount);
    }
    return [...map.entries()].map(([key, total]) => ({ key, total }));
  },

  makeMonthlyCSV(entries) {
    const totals = this.monthlyTotals(entries).sort((a, b) =>
      a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    );
    return totals.map((t) => `${t.key},${t.total}`).join('\n');
  },

  makeMonthlyCSVSortedByTotal(entries) {
    const totals = this.monthlyTotals(entries).sort((a, b) => b.total - a.total);
    return totals.map((t) => `${t.key},${t.total}`).join('\n');
  },

  makeYearDayMatrixCSV(entries) {
    if (entries.length === 0) return '';

    const years = [...new Set(entries.map((e) => e.year))].sort((a, b) => a - b);

    const map = new Map();
    for (const e of entries) {
      const key = `${String(e.year).padStart(4, '0')}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + e.characterCount);
    }

    const mdList = generateMonthDayList();
    const header = ['', ...years.map((y) => `${y}年`)].join(',');
    const rows = [header];

    for (const [m, d] of mdList) {
      const cols = [`${m}月${d}日`];
      for (const y of years) {
        const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const v = map.get(key);
        cols.push(v && v > 0 ? String(v) : '');
      }
      rows.push(cols.join(','));
    }
    return rows.join('\n');
  },
};

function generateMonthDayList() {
  // Leap year 2020 so 2/29 is included, matching Swift
  const list = [];
  const d = new Date(Date.UTC(2020, 0, 1));
  const end = new Date(Date.UTC(2020, 11, 31)).getTime();
  while (d.getTime() <= end) {
    list.push([d.getUTCMonth() + 1, d.getUTCDate()]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return list;
}

// ----- Search / Frequency -----

function containsCI(haystack, needle) {
  // Locale-aware case-insensitive contains (matches Swift's localizedCaseInsensitiveContains
  // for the cases that matter for Japanese diary text).
  if (!needle) return false;
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

export function searchEntries(entries, terms, type) {
  const valid = terms.map((t) => (t ?? '').trim()).filter((t) => t.length > 0);
  if (valid.length === 0) return [];

  return entries.filter((entry) => {
    if (type === 'and') {
      return valid.every((term) => containsCI(entry.content, term));
    }
    return valid.some((term) => containsCI(entry.content, term));
  });
}

export function calculateMonthlyFrequency(entries, terms, type) {
  const matched = searchEntries(entries, terms, type);
  const counts = new Map();
  for (const e of matched) {
    const key = `${String(e.year).padStart(4, '0')}年${String(e.month).padStart(2, '0')}月`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, count]) => ({ month, count }));
}

// ----- Comparison -----

export function compareEntries(oldEntries, newEntries) {
  const oldMap = new Map(oldEntries.map((e) => [dateKey(e), e]));
  const newMap = new Map(newEntries.map((e) => [dateKey(e), e]));
  const sortedKeys = [...oldMap.keys()].sort();
  const results = [];

  for (const key of sortedKeys) {
    const oldEntry = oldMap.get(key);
    const oldContent = oldEntry.content;

    if (newMap.has(key)) {
      const newEntry = newMap.get(key);
      const newContent = newEntry.content;
      const oldCmp = normalizeDiaryDateReferences(oldContent);
      const newCmp = normalizeDiaryDateReferences(newContent);
      if (oldCmp === newCmp) continue;
      const status = isWhitespaceOnlyChange(oldCmp, newCmp) ? 'whitespaceOnly' : 'contentChanged';
      results.push({ dateKey: key, status, oldContent, newContent });
    } else {
      results.push({ dateKey: key, status: 'missingInNew', oldContent, newContent: null });
    }
  }
  return results;
}

function dateKey(e) {
  return `${String(e.year).padStart(4, '0')}/${String(e.month).padStart(2, '0')}/${String(e.day).padStart(2, '0')}`;
}

function isWhitespaceOnlyChange(a, b) {
  return stripBlanks(a) === stripBlanks(b);
}

function stripBlanks(text) {
  return text.replace(/[\s　﻿]/g, '');
}

function fullwidthToHalfwidth(s) {
  // FF01–FF5E → 0021–007E (ASCII printable). 3000 (ideographic space) → 0020.
  return s
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

export function normalizeDiaryDateReferences(text) {
  let s = fullwidthToHalfwidth(text);
  // Old format: [[defaultJournal.dd-mm-yyyy]]
  s = s.replace(
    /\[\[defaultJournal\.(\d{1,2})-(\d{1,2})-(\d{4})\]\]/g,
    (_, dd, mm, yyyy) =>
      `__DIARY_DATE__${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}__`
  );
  // New format: yyyy年m月d日(曜)?
  s = s.replace(
    /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*[\(（][^\)）]*[\)）])?/g,
    (_, yyyy, m, d) =>
      `__DIARY_DATE__${yyyy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}__`
  );
  return s;
}
