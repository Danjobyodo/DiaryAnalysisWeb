// Search view: AND/OR full-text search over loaded diary entries.

import { el, dateString } from '../util.js';
import { getState, subscribe } from '../store.js';
import { searchEntries } from '../parser.js';
import { renderFilePicker } from './file-picker.js';

const MAX_DISPLAY = 500;

export function renderSearch() {
  const root = el('div');
  let terms = [''];
  let searchType = 'and';
  let results = null; // null = not yet searched; [] = no match

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

    conditionCard.appendChild(el('h2', {}, '検索条件'));

    const typeRow = el(
      'fieldset',
      { class: 'segmented' },
      el('legend', { class: 'sr-only' }, '検索タイプ'),
      makeRadio('search-type', 'and', 'AND (すべて含む)', searchType === 'and', (v) => {
        searchType = v;
      }),
      makeRadio('search-type', 'or', 'OR (いずれかを含む)', searchType === 'or', (v) => {
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
        placeholder: `検索ワード ${i + 1}`,
        oninput: (e) => {
          terms[i] = e.target.value;
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            runSearch();
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
                title: 'この検索ワードを削除',
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
      '＋ 検索ワードを追加'
    );

    const runBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: getState().current == null,
        onclick: runSearch,
      },
      '検索実行'
    );

    conditionCard.appendChild(el('div', { class: 'btn-row' }, addBtn, runBtn));
  }

  function runSearch() {
    const state = getState();
    if (!state.current) return;
    results = searchEntries(state.current.entries, terms, searchType);
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

    resultsCard.appendChild(el('h2', {}, '検索結果'));
    resultsCard.appendChild(
      el('p', { class: 'result-summary' }, `該当件数: `, el('strong', {}, `${results.length} 件`))
    );

    if (results.length === 0) {
      resultsCard.appendChild(el('p', { class: 'muted' }, '該当する日記はありませんでした。'));
      return;
    }

    const truncated = results.length > MAX_DISPLAY;
    const view = truncated ? results.slice(0, MAX_DISPLAY) : results;

    if (truncated) {
      resultsCard.appendChild(
        el(
          'p',
          { class: 'muted small' },
          `表示は先頭 ${MAX_DISPLAY} 件までです。すべての結果は件数のみ表示されます。`
        )
      );
    }

    const list = el('ul', { class: 'result-list' });
    for (const entry of view) {
      const preview = entry.content.length > 240 ? entry.content.slice(0, 240) + '…' : entry.content;
      list.appendChild(
        el(
          'li',
          { class: 'result-item' },
          el('div', { class: 'result-date' }, dateString(entry.date)),
          el('div', { class: 'result-body' }, preview)
        )
      );
    }
    resultsCard.appendChild(list);
  }

  // Re-render when store updates (covers cases where loading finishes)
  const unsub = subscribe(() => {
    renderConditionCard(); // re-evaluate disabled state
  });

  root.append(
    el('h1', { class: 'page-title' }, '日記を検索'),
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
