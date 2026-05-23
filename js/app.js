// Hash router and top-level layout.

import { renderHome } from './views/home.js';
import { renderSearch } from './views/search.js';
import { renderFrequency } from './views/frequency.js';
import { renderLength } from './views/length.js';
import { renderCompare, renderCompareDetail } from './views/compare.js';

const ROUTES = [
  { match: (h) => h === '' || h === '#/' || h === '#', title: 'ホーム', render: renderHome, parent: null },
  { match: (h) => h === '#/search', title: '日記を検索', render: renderSearch, parent: '#/' },
  { match: (h) => h === '#/frequency', title: 'キーワード月別頻度', render: renderFrequency, parent: '#/' },
  { match: (h) => h === '#/length', title: '文字数処理', render: renderLength, parent: '#/' },
  { match: (h) => h === '#/compare', title: '比較', render: renderCompare, parent: '#/' },
  {
    match: (h) => h.startsWith('#/compare/detail/'),
    title: '比較の詳細',
    render: (h) => renderCompareDetail(h.slice('#/compare/detail/'.length)),
    parent: '#/compare',
  },
];

const root = document.getElementById('app');
let currentCleanup = null;

function resolveRoute(hash) {
  return ROUTES.find((r) => r.match(hash)) ?? ROUTES[0];
}

function render() {
  const hash = location.hash;
  const route = resolveRoute(hash);

  // Cleanup previous view (unsubscribe store listeners etc.)
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (e) {
      console.error('cleanup error', e);
    }
    currentCleanup = null;
  }

  document.title = route.title === 'ホーム' ? '日記処理' : `${route.title} ・ 日記処理`;

  const main = document.createElement('main');
  main.className = 'main';

  // Top bar with back link to parent
  const header = document.createElement('header');
  header.className = 'topbar';

  if (route.parent != null) {
    const back = document.createElement('a');
    back.href = route.parent;
    back.className = 'topbar-back';
    back.textContent = '←';
    back.setAttribute('aria-label', '戻る');
    header.appendChild(back);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'topbar-back placeholder';
    spacer.setAttribute('aria-hidden', 'true');
    header.appendChild(spacer);
  }

  const title = document.createElement('h1');
  title.className = 'topbar-title';
  title.textContent = route.title;
  header.appendChild(title);

  // Right-side spacer keeps the title centered
  const right = document.createElement('span');
  right.className = 'topbar-back placeholder';
  right.setAttribute('aria-hidden', 'true');
  header.appendChild(right);

  const body = route.render(hash);
  main.appendChild(body);

  root.replaceChildren(header, main);
  if (typeof body._cleanup === 'function') currentCleanup = body._cleanup;

  // Scroll to top on navigation
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
if (document.readyState !== 'loading') render();
