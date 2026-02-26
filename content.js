(function () {
  'use strict';

  let files = [];
  let index = 0;

  // =========================
  // FILE PICKER UI
  // =========================
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  input.multiple = true;

  Object.assign(input.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: 9999,
    background: '#fff',
    padding: '6px',
    border: '1px solid #ccc'
  });

  document.body.appendChild(input);

  input.addEventListener('change', e => {
    files = Array.from(e.target.files);
    index = 0;
    run();
  });

  // =========================
  // MAIN LOOP
  // =========================
  async function run() {
    if (index >= files.length) {
      console.log('All chapters uploaded');
      return;
    }

    const file = files[index];
    console.log('Processing:', file.name);

    const text = await file.text();
    const { title, body } = parse(text);

    setTitle(title);
    await sleep(400);

    await waitForEditor();
    setBody(body);

    await sleep(600);
    click('PUBLISH');

    await sleep(1000);
    click('CONFIRM');

    index++;
    await sleep(2500);

    click('CREATE CHAPTER');
    await sleep(2500);

    run();
  }

  // =========================
  // PARSE FILE
  // =========================
  function parse(text) {
    const lines = text.split('\n');

    return {
      title: lines[0].trim(),
      body: lines.slice(1).join('\n').trim()
    };
  }

  // =========================
  // TITLE
  // =========================
  function setTitle(text) {
    const el =
      document.querySelector('input[placeholder="Title Here"]') ||
      document.querySelector('input[placeholder*="Title"]');

    if (!el) {
      console.log('Title input not found');
      return;
    }

    el.focus();
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // =========================
  // BODY (TinyMCE iframe)
  // =========================
  function setBody(text) {
    const iframe = document.querySelector('.tox-edit-area__iframe');
    if (!iframe) {
      console.log('Editor iframe not found');
      return;
    }

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const body = doc.body;

    body.innerHTML = '';
    body.innerText = text;
  }

  // =========================
  // WAIT FOR EDITOR READY
  // =========================
  async function waitForEditor() {
    for (let i = 0; i < 25; i++) {
      const iframe = document.querySelector('.tox-edit-area__iframe');
      if (iframe && iframe.contentDocument?.body) return;
      await sleep(200);
    }
    console.log('Editor load timeout');
  }

  // =========================
  // BUTTON CLICK
  // =========================
  function click(label) {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(el => el.textContent.trim().toUpperCase().includes(label));

    if (btn) {
      btn.click();
    } else {
      console.log(label, 'button not found');
    }
  }

  // =========================
  // UTILS
  // =========================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
