// Parser correctness tests. Run with `node tests/test-parser.mjs` from Web版/.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DiaryParser,
  DiaryStatistics,
  searchEntries,
  calculateMonthlyFrequency,
  compareEntries,
  countDiaryCharacters,
  normalizeDiaryDateReferences,
} from '../js/parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, '..', '..', '日記サンプル.txt');

let passed = 0;
let failed = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push({ name, detail });
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, a === e ? '' : `expected ${e}, got ${a}`);
}

// ---- 1. Character counting ----
console.log('Character counting:');
eq('empty', countDiaryCharacters(''), 0);
eq('ASCII spaces & newlines excluded', countDiaryCharacters('a b\nc\td'), 4);
eq('full-width space excluded', countDiaryCharacters('あ　い'), 2);
eq('emoji counted as 1', countDiaryCharacters('😀x'), 2);
eq('combining grapheme = 1', countDiaryCharacters('👨‍👩‍👧'), 1);
eq('only whitespace = 0', countDiaryCharacters('   \n\t　'), 0);

// ---- 2. Parsing sample file ----
console.log('\nSample file:');
const rawSample = await fs.readFile(SAMPLE, 'utf-8');
const sampleEntries = DiaryParser.parseEntries(rawSample);
eq('entry count', sampleEntries.length, 4);
eq('first date', sampleEntries[0] && [sampleEntries[0].year, sampleEntries[0].month, sampleEntries[0].day], [2017, 12, 19]);
eq('last date', sampleEntries[3] && [sampleEntries[3].year, sampleEntries[3].month, sampleEntries[3].day], [2018, 5, 31]);

// Spot-check the body strips the date header
ok(
  'body excludes header line',
  !sampleEntries[0].content.startsWith('2017/12/19'),
  `got: ${sampleEntries[0].content.slice(0, 20)}`
);

// Per-entry counts: independently recomputed by stripping whitespace and counting grapheme clusters
const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
for (const e of sampleEntries) {
  let manual = 0;
  for (const { segment } of seg.segment(e.content)) {
    if (!/^[\s　﻿]+$/.test(segment)) manual++;
  }
  eq(`count matches manual recount for ${e.year}/${e.month}/${e.day}`, e.characterCount, manual);
}

// ---- 3. Statistics ----
console.log('\nStatistics:');
const monthly = DiaryStatistics.monthlyTotals(sampleEntries).sort((a, b) =>
  a.key < b.key ? -1 : 1
);
const monthlyKeys = monthly.map((m) => m.key);
eq('monthly keys', monthlyKeys, ['2017-12', '2018-01', '2018-02', '2018-05']);

// 2018-01 monthly total should equal that entry's character count (only one entry that month)
const jan = sampleEntries.find((e) => e.year === 2018 && e.month === 1);
const janTotal = monthly.find((m) => m.key === '2018-01').total;
eq('2018-01 monthly total = entry count', janTotal, jan.characterCount);

eq('total = sum of entries', DiaryStatistics.totalCharacterCount(sampleEntries),
   sampleEntries.reduce((s, e) => s + e.characterCount, 0));

const dailyCSV = DiaryStatistics.makeDailyCSV(sampleEntries);
const dailyLines = dailyCSV.split('\n');
eq('daily csv line count', dailyLines.length, sampleEntries.length);
ok('daily csv format year,month,day,count', /^\d{4},\d{1,2},\d{1,2},\d+$/.test(dailyLines[0]),
   `got: ${dailyLines[0]}`);

const monthlyCSV = DiaryStatistics.makeMonthlyCSV(sampleEntries);
ok('monthly csv format YYYY-MM,total', /^\d{4}-\d{2},\d+$/.test(monthlyCSV.split('\n')[0]),
   `got: ${monthlyCSV.split('\n')[0]}`);

const matrix = DiaryStatistics.makeYearDayMatrixCSV(sampleEntries);
const matrixRows = matrix.split('\n');
eq('matrix header column count', matrixRows[0].split(',').length, 1 + 2); // empty + 2017 + 2018
ok('matrix has 367 rows (header + 366 days)', matrixRows.length === 367,
   `got ${matrixRows.length}`);

const firstDataCol = matrixRows[1].split(',');
eq('first data row starts with 1月1日', firstDataCol[0], '1月1日');

// 2018-02-29 doesn't exist, so 2/29 row should have empty cells
const feb29Row = matrixRows.find((r) => r.startsWith('2月29日,'));
ok('feb29 row exists in leap-year-based matrix', !!feb29Row);
const feb29Cols = feb29Row.split(',');
eq('feb29 values are all empty', feb29Cols.slice(1), ['', '']);

// 2017-12-19 row should have the 2017 column populated, 2018 column empty
const dec19Row = matrixRows.find((r) => r.startsWith('12月19日,'));
const dec19Cols = dec19Row.split(',');
ok('dec19 2017 value populated', dec19Cols[1] !== '');
eq('dec19 2018 value empty', dec19Cols[2], '');

// ---- 4. Search ----
console.log('\nSearch:');
const r1 = searchEntries(sampleEntries, ['桃花源記'], 'and');
eq('search 桃花源記 matches one entry', r1.length, 1);
eq('that entry is 2018/01/12', [r1[0].year, r1[0].month, r1[0].day], [2018, 1, 12]);

const r2 = searchEntries(sampleEntries, ['合唱祭', '安藤'], 'and');
eq('AND 合唱祭+安藤 matches one entry', r2.length, 1);
eq('that entry is 2018/02/16', [r2[0].year, r2[0].month, r2[0].day], [2018, 2, 16]);

const r3 = searchEntries(sampleEntries, ['チェロ', '合唱祭'], 'or');
eq('OR チェロ|合唱祭 matches two entries', r3.length, 2);

const r4 = searchEntries(sampleEntries, ['  '], 'and'); // empty after trim
eq('empty terms returns []', r4.length, 0);

// ---- 5. Frequency ----
console.log('\nFrequency:');
const freq = calculateMonthlyFrequency(sampleEntries, ['チェロ'], 'and');
eq('frequency: チェロ found in 1 month', freq.length, 1);
eq('frequency: month key includes 2018年01月', freq[0].month, '2018年01月');
eq('frequency: 1 day count', freq[0].count, 1);

// ---- 6. Compare ----
console.log('\nCompare:');
const oldEntries = sampleEntries;
// Simulate a new file: drop one entry, slightly change another
const newEntries = sampleEntries
  .filter((e) => !(e.year === 2017 && e.month === 12)) // remove 2017/12/19
  .map((e) => {
    if (e.year === 2018 && e.month === 5) {
      // whitespace-only change
      return { ...e, content: e.content + '\n  \n' };
    }
    if (e.year === 2018 && e.month === 2) {
      return { ...e, content: e.content + '＿追加された内容' };
    }
    return e;
  });

const cmp = compareEntries(oldEntries, newEntries);
const cmpByDate = Object.fromEntries(cmp.map((c) => [c.dateKey, c]));
eq('compare: total diff count', cmp.length, 3);
eq('compare: 2017/12/19 missingInNew', cmpByDate['2017/12/19'].status, 'missingInNew');
eq('compare: 2018/02/16 contentChanged', cmpByDate['2018/02/16'].status, 'contentChanged');
eq('compare: 2018/05/31 whitespaceOnly', cmpByDate['2018/05/31'].status, 'whitespaceOnly');
ok('compare: identical entry not in result', !cmpByDate['2018/01/12']);

// ---- 7. Date-reference normalization ----
console.log('\nDate reference normalization:');
const oldRef = '前日の参考: [[defaultJournal.05-12-2018]]';
const newRef = '前日の参考: 2018年12月5日(水)';
const a = normalizeDiaryDateReferences(oldRef);
const b = normalizeDiaryDateReferences(newRef);
eq('old & new ref normalize to same token', a, b);

// Full-width digit in new style should still match
const newRefFW = '前日の参考: ２０１８年１２月５日';
eq('fullwidth digit normalized matches halfwidth', normalizeDiaryDateReferences(newRefFW), b);

// ---- 8. Compare with date-reference noise ----
console.log('\nCompare uses normalized refs:');
const oldNoise = { year: 2024, month: 1, day: 1, date: new Date(Date.UTC(2024, 0, 1)),
  content: '昨日: [[defaultJournal.31-12-2023]] のメモ', characterCount: 0 };
const newNoise = { year: 2024, month: 1, day: 1, date: new Date(Date.UTC(2024, 0, 1)),
  content: '昨日: 2023年12月31日(日) のメモ', characterCount: 0 };
const noiseCmp = compareEntries([oldNoise], [newNoise]);
eq('date-ref-only diff produces 0 changes', noiseCmp.length, 0);

// ---- 9. Multi-line body within an entry ----
console.log('\nMulti-line body:');
const multi = `2020/01/01
一行目
二行目

途中の空行

四行目`;
const me = DiaryParser.parseEntries(multi);
eq('multi-line: single entry', me.length, 1);
ok(
  'multi-line: body preserves internal blank line',
  me[0].content.split('\n').length >= 5,
  `body lines = ${me[0].content.split('\n').length}`
);

// ---- 10. YYYY/MM/DD inside body is NOT a delimiter (only when preceded by blank line) ----
console.log('\nNon-delimiter date in body:');
const tricky = `2020/01/01
本文。2020/01/02 は予定の話。
続く本文。

2020/01/03
別エントリ`;
const te = DiaryParser.parseEntries(tricky);
eq('tricky: 2 entries (not 3)', te.length, 2);

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  - ${f.name}: ${f.detail ?? ''}`);
  process.exit(1);
}
