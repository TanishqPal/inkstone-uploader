(function () {
  'use strict';

  let files = [];
  let index = 0;

  // =========================
  // FILE INPUT
  // =========================
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  input.multiple = true;
  input.style.position = 'fixed';
  input.style.top = '10px';
  input.style.right = '10px';
  input.style.zIndex = 9999;

  document.body.appendChild(input);

  input.addEventListener('change', e => {
    files = Array.from(e.target.files);
    index = 0;
    processNext();
  });

  // =========================
  // CORE LOGIC
  // =========================
  async function processNext() {
    if (index >= files.length) {
      console.log('Done');
      return;
    }

    const file = files[index];
    const text = await file.text();

    const { title, body } = parseChapter(text);

    fillTitle(title);
    fillBody(body);

    await sleep(500);

    clickPublish();
    await sleep(1000);
    clickConfirm();

    index++;
    await sleep(2000);

    clickCreateChapter();
    await sleep(2000);

    processNext();
  }

  // =========================
  // PARSE CHAPTER
  // =========================
  function parseChapter(text) {
    const lines = text.split('\n');

    const title = lines[0].trim(); // first line = chapter title
    const body = lines.slice(1).join('\n').trim();

    return { title, body };
  }

  // =========================
  // DOM HELPERS
  // =========================
  function fillTitle(text) {
    const el = document.querySelector('input[placeholder*="Title"]');
    if (!el) return;

    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function fillBody(text) {
    const el = document.querySelector('textarea, [contenteditable="true"]');
    if (!el) return;

    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  function clickPublish() {
    const btn = findButton('PUBLISH');
    if (btn) btn.click();
  }

  function clickConfirm() {
    const btn = findButton('CONFIRM');
    if (btn) btn.click();
  }

  function clickCreateChapter() {
    const btn = findButton('CREATE CHAPTER');
    if (btn) btn.click();
  }

  function findButton(text) {
    return Array.from(document.querySelectorAll('button, a'))
      .find(el => el.textContent.trim().toUpperCase().includes(text));
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

})();
