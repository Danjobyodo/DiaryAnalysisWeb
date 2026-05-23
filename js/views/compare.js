// Compare view: choose old & new files and show day-by-day differences.

import { el } from '../util.js';
import { getState, subscribe, setComparisons } from '../store.js';
import { compareEntries } from '../parser.js';
import { renderFilePicker } from './file-picker.js';

const STATUS_LABEL = {
  missingInNew: '新版から欠落',
  whitespaceOnly: '空白のみ変更',
  contentChanged: '内容変更あり',
};
const STATUS_CLASS = {
  missingInNew: 'status-missing',
  whitespaceOnly: 'status-whitespace',
  contentChanged: 'status-changed',
};

export function renderCompare() {
  const root = el('div');

  let showWhitespaceOnly = false;
  let didCompare = !!getState().comparisons;

  const oldPicker = renderFilePicker({
    slot: 'old',
    title: '旧データ',
    allowReuseCurrent: true,
    onChange: () => {
      setComparisons(null);
      didCompare = false;
      renderRunCard();
      renderResultsCard();
    },
  });
  const newPicker = renderFilePicker({
    slot: 'new',
    title: '新データ',
    allowReuseCurrent: true,
    onChange: () => {
      setComparisons(null);
      didCompare = false;
      renderRunCard();
      renderResultsCard();
    },
  });

  const runCard = el('section', { class: 'card' });
  const resultsCard = el('section', { class: 'card', hidden: true });

  function renderRunCard() {
    runCard.replaceChildren();
    runCard.appendChild(el('h2', {}, '比較'));
    const state = getState();
    const ready = !!(state.oldFile && state.newFile);
    if (!ready) {
      runCard.appendChild(
        el('p', { class: 'muted small' }, '旧データと新データの両方を選択すると実行できます。')
      );
    }
    const btn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn-primary',
        disabled: !ready,
        onclick: runCompare,
      },
      '比較を実行'
    );
    runCard.appendChild(el('div', { class: 'btn-row' }, btn));
  }

  function runCompare() {
    const state = getState();
    if (!state.oldFile || !state.newFile) return;
    const results = compareEntries(state.oldFile.entries, state.newFile.entries);
    setComparisons(results);
    didCompare = true;
    renderResultsCard();
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResultsCard() {
    resultsCard.replaceChildren();
    if (!didCompare) {
      resultsCard.hidden = true;
      return;
    }
    resultsCard.hidden = false;
    resultsCard.appendChild(el('h2', {}, '変更があった日付'));

    const comparisons = getState().comparisons ?? [];
    if (comparisons.length === 0) {
      resultsCard.appendChild(
        el('p', { class: 'muted' }, '旧データと新データの間に変更は見つかりませんでした。')
      );
      return;
    }

    const hasWhitespace = comparisons.some((c) => c.status === 'whitespaceOnly');
    const visible = comparisons.filter(
      (c) => showWhitespaceOnly || c.status !== 'whitespaceOnly'
    );

    const summary = el('p', { class: 'result-summary' },
      `総差分: `,
      el('strong', {}, `${comparisons.length} 件`),
      hasWhitespace ? `（表示: ${visible.length} 件）` : ''
    );
    resultsCard.appendChild(summary);

    if (hasWhitespace) {
      const toggleId = 'show-ws-only';
      const toggle = el(
        'label',
        { class: 'toggle-row', for: toggleId },
        el('input', {
          type: 'checkbox',
          id: toggleId,
          checked: showWhitespaceOnly,
          onchange: (e) => {
            showWhitespaceOnly = e.target.checked;
            renderResultsCard();
          },
        }),
        el('span', {}, '空白のみ変更も表示する')
      );
      resultsCard.appendChild(toggle);
    }

    if (visible.length === 0) {
      resultsCard.appendChild(el('p', { class: 'muted' }, '表示する変更はありません。'));
      return;
    }

    const list = el('ul', { class: 'compare-list' });
    visible.forEach((item, idx) => {
      // Find the index in the full comparisons array so the detail route can locate it
      const originalIdx = comparisons.indexOf(item);
      list.appendChild(
        el(
          'li',
          {},
          el(
            'a',
            { href: `#/compare/detail/${originalIdx}`, class: 'compare-link' },
            el('span', { class: 'compare-date' }, item.dateKey),
            el(
              'span',
              { class: `compare-status ${STATUS_CLASS[item.status]}` },
              STATUS_LABEL[item.status]
            )
          )
        )
      );
    });
    resultsCard.appendChild(list);
  }

  const unsub = subscribe(() => {
    renderRunCard();
  });

  root.append(
    el('h1', { class: 'page-title' }, '比較'),
    oldPicker,
    newPicker,
    runCard,
    resultsCard
  );
  renderRunCard();
  renderResultsCard();

  root._cleanup = () => {
    unsub();
    oldPicker._cleanup?.();
    newPicker._cleanup?.();
  };
  return root;
}

export function renderCompareDetail(indexStr) {
  const root = el('div');
  const comparisons = getState().comparisons ?? [];
  const idx = Number(indexStr);

  if (!Number.isInteger(idx) || idx < 0 || idx >= comparisons.length) {
    root.append(
      el('h1', { class: 'page-title' }, '詳細'),
      el(
        'section',
        { class: 'card' },
        el('p', { class: 'muted' }, '比較結果が見つかりません。比較画面からやり直してください。'),
        el('p', {}, el('a', { href: '#/compare', class: 'btn btn-secondary' }, '比較画面に戻る'))
      )
    );
    return root;
  }

  const c = comparisons[idx];
  const wrapperClass =
    c.status === 'missingInNew' ? 'detail-single' : 'detail-split';

  const headerCard = el(
    'section',
    { class: 'card' },
    el('div', { class: 'detail-head' },
      el('div', { class: 'detail-date' }, c.dateKey),
      el(
        'div',
        { class: `compare-status ${STATUS_CLASS[c.status]}` },
        STATUS_LABEL[c.status]
      )
    )
  );

  const oldPane = el(
    'div',
    { class: 'detail-pane' },
    el('h3', {}, `旧（${c.dateKey}）`),
    el('pre', { class: 'detail-body' }, c.oldContent ?? '（旧データなし）')
  );

  const newPane = el(
    'div',
    { class: 'detail-pane' },
    el('h3', {}, `新（${c.dateKey}）`),
    el(
      'pre',
      { class: 'detail-body' },
      c.newContent ?? '（新データなし）'
    )
  );

  const detailGrid = el('section', { class: `card ${wrapperClass}` }, oldPane, newPane);

  const back = el(
    'p',
    { class: 'back-link' },
    el('a', { href: '#/compare' }, '← 比較結果に戻る')
  );

  root.append(el('h1', { class: 'page-title' }, '差分の詳細'), headerCard, detailGrid, back);
  return root;
}
