// Reusable file picker section. Renders into a parent element.
// Shows current file (if loaded) and a button to pick another.

import { el, fmtSize } from '../util.js';
import { getState, loadFileInto, subscribe, copyCurrentInto } from '../store.js';

/**
 * Renders a file picker for a specific slot.
 *
 * @param {Object} opts
 * @param {'current' | 'old' | 'new'} opts.slot - Which store slot this picker controls.
 * @param {string} opts.title - Section label (e.g. "日記ファイル").
 * @param {boolean} [opts.allowReuseCurrent] - If true and slot != 'current', show a button to reuse the home file.
 * @param {() => void} [opts.onChange] - Called after the slot's file changes.
 */
export function renderFilePicker(opts) {
  const { slot, title, allowReuseCurrent = false, onChange } = opts;
  const root = el('section', { class: 'card file-picker' });
  const status = el('div', { class: 'file-status' });
  const errorBox = el('div', { class: 'file-error', role: 'alert' });
  const progress = el('div', { class: 'file-progress', hidden: true }, '読み込み中…');

  const fileInput = el('input', {
    type: 'file',
    accept: '.txt,text/plain',
    hidden: true,
    onchange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      await handleLoad(file);
    },
  });

  const pickBtn = el(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: () => fileInput.click(),
    },
    '別のファイルを選択'
  );

  const reuseBtn = el(
    'button',
    {
      class: 'btn btn-secondary',
      type: 'button',
      hidden: true,
      onclick: () => {
        copyCurrentInto(slot);
        onChange?.();
      },
    },
    'ホームで読み込んだファイルを使う'
  );

  const header = el('div', { class: 'file-picker-head' },
    el('h2', {}, title),
    el('div', { class: 'file-picker-actions' }, pickBtn, allowReuseCurrent ? reuseBtn : null, fileInput)
  );

  async function handleLoad(file) {
    errorBox.textContent = '';
    progress.hidden = false;
    try {
      await loadFileInto(slot, file);
      onChange?.();
    } catch (err) {
      errorBox.textContent = `読み込み失敗: ${err?.message ?? err}`;
    } finally {
      progress.hidden = true;
      render();
    }
  }

  function render() {
    const state = getState();
    const record =
      slot === 'current' ? state.current : slot === 'old' ? state.oldFile : state.newFile;

    status.replaceChildren();

    if (record) {
      status.appendChild(
        el(
          'div',
          { class: 'file-info' },
          el('div', { class: 'file-name' }, record.name),
          el(
            'div',
            { class: 'file-meta' },
            `${record.entries.length} 日分のエントリ`,
            record.size != null ? ` ・ ${fmtSize(record.size)}` : ''
          )
        )
      );
      pickBtn.textContent = '別のファイルを選択';
    } else {
      status.appendChild(el('div', { class: 'file-empty' }, 'まだファイルが読み込まれていません。'));
      pickBtn.textContent = 'ファイルを選択';
    }

    if (allowReuseCurrent) {
      const hasCurrent = !!state.current;
      const isSameAsCurrent =
        hasCurrent &&
        record &&
        record.name === state.current.name &&
        record.entries === state.current.entries;
      reuseBtn.hidden = !hasCurrent || isSameAsCurrent;
      if (!reuseBtn.hidden) {
        reuseBtn.textContent = record
          ? `ホームの「${state.current.name}」に差し替える`
          : `ホームの「${state.current.name}」を使う`;
      }
    }
  }

  const unsub = subscribe(render);
  root.append(header, status, progress, errorBox);
  render();

  // Attach a cleanup hook so the router can tear listeners down
  root._cleanup = () => unsub();
  return root;
}
