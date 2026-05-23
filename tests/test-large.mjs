// Synthetic large-file stress test (~12MB).

import {
  DiaryParser,
  DiaryStatistics,
  searchEntries,
  calculateMonthlyFrequency,
} from '../js/parser.js';

console.log('Generating synthetic diary (~12 MB)…');
const t0 = performance.now();

// 8 years × 365 days = 2920 entries, average body ~4 KB → ~12 MB
const bodyTemplate = [
  '今日は午前中に作業を進めた。',
  '途中で珈琲を入れて、また続きを書いた。',
  'チェロの練習も少しだけやった。',
  '夜は読書。',
  '量子情報の本を読み返して、誤り訂正の章で躓いた。',
  '明日続きをやろう。',
].join('\n');
const filler = (bodyTemplate + '\n').repeat(50); // ~4 KB per entry

const lines = [];
const startYear = 2017;
const yearCount = 8;
for (let y = 0; y < yearCount; y++) {
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(Date.UTC(startYear + y, m, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${startYear + y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      lines.push(date);
      lines.push(filler);
      lines.push(''); // blank line between entries
    }
  }
}
const text = lines.join('\n');
const sizeMB = (Buffer.byteLength(text, 'utf-8') / 1024 / 1024).toFixed(2);
console.log(`  text size: ${sizeMB} MB, lines: ${lines.length}`);
console.log(`  generation: ${(performance.now() - t0).toFixed(0)} ms`);

console.log('\nParsing…');
const t1 = performance.now();
const entries = DiaryParser.parseEntries(text);
const parseMs = performance.now() - t1;
console.log(`  parsed ${entries.length} entries in ${parseMs.toFixed(0)} ms`);

console.log('\nStatistics…');
const t2 = performance.now();
const total = DiaryStatistics.totalCharacterCount(entries);
const monthly = DiaryStatistics.monthlyTotals(entries);
const matrix = DiaryStatistics.makeYearDayMatrixCSV(entries);
const statsMs = performance.now() - t2;
console.log(`  total chars: ${total.toLocaleString()}`);
console.log(`  monthly buckets: ${monthly.length}`);
console.log(`  matrix length: ${matrix.length} chars`);
console.log(`  stats: ${statsMs.toFixed(0)} ms`);

console.log('\nSearch…');
const t3 = performance.now();
const r = searchEntries(entries, ['量子', '誤り'], 'and');
const searchMs = performance.now() - t3;
console.log(`  matches: ${r.length} in ${searchMs.toFixed(0)} ms`);

console.log('\nFrequency…');
const t4 = performance.now();
const f = calculateMonthlyFrequency(entries, ['チェロ'], 'and');
const freqMs = performance.now() - t4;
console.log(`  months: ${f.length} in ${freqMs.toFixed(0)} ms`);

// Sanity check
const expectedEntries = (() => {
  let n = 0;
  for (let y = 0; y < yearCount; y++) {
    for (let m = 1; m <= 12; m++) {
      n += new Date(Date.UTC(startYear + y, m, 0)).getUTCDate();
    }
  }
  return n;
})();

if (entries.length !== expectedEntries) {
  console.error(`\nFAIL: expected ${expectedEntries} entries, got ${entries.length}`);
  process.exit(1);
}
console.log(`\nOK (${expectedEntries} entries as expected)`);
