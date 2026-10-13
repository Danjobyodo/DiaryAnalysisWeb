import assert from 'node:assert/strict';
import { countDiaryCharacters, DiaryParser } from '../js/parser.js';

const cases = [
  ['', 0], ['a b\nc\td　', 4], ['ｶﾞ', 1], ['ﾊﾟ', 1], ['ｶﾞ😀', 2],
  ['か\u3099', 1], ['👨‍👩‍👧', 1], ['가', 1],
  ['A\u0085B', 2], ['A\u200BB', 2], ['A\uFEFFB', 3],
  ['a \u0301', 2], // Do not remove the space before segmentation.
];
for (const [text, expected] of cases) {
  assert.equal(countDiaryCharacters(text), expected, JSON.stringify(text));
}
const entries = DiaryParser.parseEntries('2026/10/13\nｶﾞ ﾊﾟ\n\n2026/10/14\nｶﾞ😀');
assert.deepEqual(entries.map(e => e.characterCount), [2, 2]);
assert.equal(DiaryParser.parseEntries('2026/10/13\n\uFEFFA\uFEFF')[0].characterCount, 3);
assert.equal(DiaryParser.parseEntries('2026/10/13\n\u200BA\u200B')[0].characterCount, 1);
console.log(`${cases.length + 3} character-count checks passed.`);
