// Length-processing view: daily / monthly / year-day-matrix CSV exports.

import { el, downloadText } from '../util.js';
import { getState, subscribe } from '../store.js';
import { DiaryStatistics } from '../parser.js';
import { renderFilePicker } from './file-picker.js';

export function renderLength() {
  const root = el('div');
  let dailySort = 'dateAscending'; // 'dateAscending' | 'lengthDescending'
  let monthlySort = 'monthAscending'; // 'monthAscending' | 'totalDescending'

  const picker = renderFilePicker({ slot: 'current', title: '日記ファイル', onChange: () => rerender() });

  const summaryCard = el('section', { class: 'card' });
  const dailyCard = el('section', { class: 'card' });
  const monthlyCard = el('section', { class: 'card' });
  const matrixCard = el('section', { class: 'card' });

  function disabled() {
    return getState().current == null || getState().current.entries.length === 0;
  }

  function rerender() {
    renderSummary();
    renderDaily();
    renderMonthly();
    renderMatrix();
  }

  function renderSummary() {
    summaryCard.replaceChildren();
    summaryCard.appendChild(el('h2', {}, '全体情報'));
    const state = getState();
    if (!state.current) {
      summaryCard.appendChild(
        el('p', { class: 'muted' }, '上で日記ファイルを選択してください。')
      );
      return;
    }
    const total = DiaryStatistics.totalCharacterCount(state.current.entries);
    summaryCard.appendChild(
      el(
        'dl',
        { class: 'kv' },
        el('dt', {}, 'エントリ数'),
        el('dd', {}, `${state.current.entries.length} 日`),
        el('dt', {}, '本文文字数の総合計'),
        el('dd', { class: 'strong' }, `${total.toLocaleString()} 文字`)
      )
    );
  }

  function renderDaily() {
    dailyCard.replaceChildren();
    dailyCard.appendChild(el('h2', {}, '日別ソート'));
    const seg = el(
      'fieldset',
      { class: 'segmented' },
      el('legend', { class: 'sr-only' }, '日別の並び順'),
      makeRadio('daily-sort', 'dateAscending', '日付順', dailySort === 'dateAscending', (v) => {
        dailySort = v;
      }),
      makeRadio(
        'daily-sort',
        'lengthDescending',
        '文字数多い順',
        dailySort === 'lengthDescending',
        (v) => {
          dailySort = v;
        }
      )
    );
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: disabled(),
        onclick: exportDailyCSV,
      },
      '日別データを CSV として出力'
    );
    const note = el(
      'p',
      { class: 'muted small' },
      'フォーマット: year,month,day,count（ヘッダーなし）'
    );
    dailyCard.append(seg, el('div', { class: 'btn-row' }, btn), note);
  }

  function renderMonthly() {
    monthlyCard.replaceChildren();
    monthlyCard.appendChild(el('h2', {}, '月別合計'));
    const seg = el(
      'fieldset',
      { class: 'segmented' },
      el('legend', { class: 'sr-only' }, '月別の並び順'),
      makeRadio('monthly-sort', 'monthAscending', '月順', monthlySort === 'monthAscending', (v) => {
        monthlySort = v;
      }),
      makeRadio(
        'monthly-sort',
        'totalDescending',
        '合計多い順',
        monthlySort === 'totalDescending',
        (v) => {
          monthlySort = v;
        }
      )
    );
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: disabled(),
        onclick: exportMonthlyCSV,
      },
      '月別合計を CSV として出力'
    );
    const note = el(
      'p',
      { class: 'muted small' },
      'フォーマット: YYYY-MM,totalCount（ヘッダーなし）'
    );
    monthlyCard.append(seg, el('div', { class: 'btn-row' }, btn), note);
  }

  function renderMatrix() {
    matrixCard.replaceChildren();
    matrixCard.appendChild(el('h2', {}, '年×日テーブル'));
    matrixCard.appendChild(
      el(
        'p',
        { class: 'muted small' },
        '行: 1月1日〜12月31日（うるう年含む）、列: 年（2017年, 2018年, …）。値のないセルは空欄。'
      )
    );
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: disabled(),
        onclick: exportMatrixCSV,
      },
      '年×日テーブルを CSV として出力'
    );
    matrixCard.appendChild(el('div', { class: 'btn-row' }, btn));
  }

  function exportDailyCSV() {
    const state = getState();
    if (!state.current) return;
    const entries = [...state.current.entries];
    if (dailySort === 'dateAscending') {
      entries.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      });
    } else {
      entries.sort((a, b) => b.characterCount - a.characterCount);
    }
    const csv = DiaryStatistics.makeDailyCSV(entries, { sortByCount: false });
    downloadText('diary_daily_sorted.csv', csv);
  }

  function exportMonthlyCSV() {
    const state = getState();
    if (!state.current) return;
    const totals = DiaryStatistics.monthlyTotals(state.current.entries);
    if (monthlySort === 'monthAscending') totals.sort((a, b) => (a.key < b.key ? -1 : 1));
    else totals.sort((a, b) => b.total - a.total);
    const csv = totals.map((t) => `${t.key},${t.total}`).join('\n');
    downloadText('diary_monthly_totals.csv', csv);
  }

  function exportMatrixCSV() {
    const state = getState();
    if (!state.current) return;
    const csv = DiaryStatistics.makeYearDayMatrixCSV(state.current.entries);
    downloadText('diary_year_day_matrix.csv', csv);
  }

  const unsub = subscribe(rerender);
  root.append(
    el('h1', { class: 'page-title' }, '文字数処理'),
    picker,
    summaryCard,
    dailyCard,
    monthlyCard,
    matrixCard
  );
  rerender();
  root._cleanup = () => {
    unsub();
    picker._cleanup?.();
  };
  return root;
}

function makeRadio(name, value, label, checked, onChange) {
  const id = `${name}-${value}`;
  const input = el('input', {
    type: 'radio',
    name,
    value,
    id,
    checked,
    onchange: (e) => onChange(e.target.value),
  });
  return el('label', { for: id, class: 'segmented-option' }, input, el('span', {}, label));
}
