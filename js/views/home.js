// Home screen: navigation to sub-apps. No file picker here (per Web版 spec change).

import { el } from '../util.js';
import { getState, subscribe } from '../store.js';

const FEATURES = [
  { route: '#/search', label: '検索', icon: '🔍', desc: 'AND/OR で複数キーワードの日記を全文検索します。' },
  { route: '#/frequency', label: 'キーワード月別頻度', icon: '📅', desc: '指定キーワードが何月に何日登場したかを集計します。' },
  { route: '#/length', label: '文字数処理', icon: '📊', desc: '日別・月別の文字数 CSV、年×日テーブルを書き出します。' },
  { route: '#/compare', label: '比較', icon: '🪞', desc: '旧データと新データを照合して差分を抽出します。' },
];

export function renderHome() {
  const root = el('div');

  const heroNote = el('div', { class: 'card' },
    el('p', { class: 'lead' }, '日記テキストを解析するための小さなツール群です。'),
    el(
      'p',
      { class: 'muted small' },
      'ファイルは各機能の中で選択します。最後に開いたファイルは別の機能でも再利用できます。'
    )
  );

  const summary = el('div', { class: 'card', hidden: true });

  const updateSummary = () => {
    const state = getState();
    if (!state.current) {
      summary.hidden = true;
      summary.replaceChildren();
      return;
    }
    summary.hidden = false;
    summary.replaceChildren(
      el('h2', {}, '直近に読み込んだファイル'),
      el(
        'div',
        { class: 'file-info' },
        el('div', { class: 'file-name' }, state.current.name),
        el('div', { class: 'file-meta' }, `${state.current.entries.length} 日分のエントリ`)
      ),
      el('p', { class: 'muted small' }, '各機能でそのまま再利用できます。')
    );
  };

  const list = el('ul', { class: 'feature-list' });
  for (const f of FEATURES) {
    list.appendChild(
      el(
        'li',
        {},
        el(
          'a',
          { href: f.route, class: 'feature-link' },
          el('span', { class: 'feature-icon' }, f.icon),
          el(
            'span',
            { class: 'feature-text' },
            el('span', { class: 'feature-label' }, f.label),
            el('span', { class: 'feature-desc' }, f.desc)
          ),
          el('span', { class: 'feature-arrow' }, '›')
        )
      )
    );
  }

  const unsub = subscribe(updateSummary);
  root.append(heroNote, summary, el('h2', { class: 'section-heading' }, '機能'), list);
  updateSummary();
  root._cleanup = () => unsub();
  return root;
}
