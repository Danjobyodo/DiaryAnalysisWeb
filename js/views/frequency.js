// Monthly frequency view: counts how many days per month match the given keywords.

import { el } from '../util.js';
import { getState, subscribe } from '../store.js';
import { calculateMonthlyFrequency } from '../parser.js';
import { renderFilePicker } from './file-picker.js';

export function renderFrequency() {
  const root = el('div');
  let terms = [''];
  let searchType = 'and';
  let results = null;

  const picker = renderFilePicker({
    slot: 'current',
    title: '日記ファイル',
    onChange: () => {
      results = null;
      rerender();
    },
  });

  const conditionCard = el('section', { class: 'card' });
  const resultsCard = el('section', { class: 'card', hidden: true });

  function rerender() {
    renderConditionCard();
    renderResults();
  }

  function renderConditionCard() {
    conditionCard.replaceChildren();
    conditionCard.appendChild(el('h2', {}, '分析条件'));

    const typeRow = el(
      'fieldset',
      { class: 'segmented' },
      el('legend', { class: 'sr-only' }, '検索タイプ'),
      makeRadio('freq-type', 'and', 'AND (すべて含む)', searchType === 'and', (v) => {
        searchType = v;
      }),
      makeRadio('freq-type', 'or', 'OR (いずれかを含む)', searchType === 'or', (v) => {
        searchType = v;
      })
    );
    conditionCard.appendChild(typeRow);

    const termList = el('div', { class: 'term-list' });
    terms.forEach((term, i) => {
      const input = el('input', {
        type: 'search',
        class: 'term-input',
        value: term,
        placeholder: `キーワード ${i + 1}`,
        oninput: (e) => {
          terms[i] = e.target.value;
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            runAnalysis();
          }
        },
      });
      const removeBtn =
        terms.length > 1
          ? el(
              'button',
              {
                type: 'button',
                class: 'btn btn-icon btn-danger',
                title: 'このキーワードを削除',
                onclick: () => {
                  terms.splice(i, 1);
                  rerender();
                },
              },
              '−'
            )
          : null;
      termList.appendChild(el('div', { class: 'term-row' }, input, removeBtn));
    });
    conditionCard.appendChild(termList);

    const addBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: () => {
          terms.push('');
          rerender();
        },
      },
      '＋ キーワードを追加'
    );

    const runBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: getState().current == null,
        onclick: runAnalysis,
      },
      '分析実行'
    );

    conditionCard.appendChild(el('div', { class: 'btn-row' }, addBtn, runBtn));
  }

  function runAnalysis() {
    const state = getState();
    if (!state.current) return;
    results = calculateMonthlyFrequency(state.current.entries, terms, searchType);
    renderResults();
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResults() {
    resultsCard.replaceChildren();
    if (results == null) {
      resultsCard.hidden = true;
      return;
    }
    resultsCard.hidden = false;
    resultsCard.appendChild(el('h2', {}, '月別登場日数'));
    resultsCard.appendChild(
      el(
        'p',
        { class: 'result-summary' },
        '該当する日記が含まれる月: ',
        el('strong', {}, `${results.length} ヶ月`)
      )
    );

    if (results.length === 0) {
      resultsCard.appendChild(el('p', { class: 'muted' }, '該当する日記はありませんでした。'));
      return;
    }

    const table = el(
      'table',
      { class: 'freq-table' },
      el('thead', {}, el('tr', {}, el('th', {}, '月'), el('th', {}, '日数'))),
      el(
        'tbody',
        {},
        ...results.map((r) =>
          el('tr', {}, el('td', {}, r.month), el('td', { class: 'num' }, `${r.count} 日`))
        )
      )
    );
    resultsCard.appendChild(table);
  }

  const unsub = subscribe(() => renderConditionCard());

  root.append(
    el('h1', { class: 'page-title' }, 'キーワード月別頻度'),
    picker,
    conditionCard,
    resultsCard
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
