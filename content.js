// ================================================================
// Inkstone Chapter Uploader - content.js
// Runs in MAIN world (manifest world: "MAIN") so it can access
// window.tinymce directly without any bridge.
// ================================================================

(function () {
  'use strict';

  let files = [];
  let currentIndex = 0;
  let stopRequested = false;

  // Boot: inject panel once
  const bootInterval = setInterval(() => {
    if (document.getElementById('icu-panel')) return;
    injectPanel();
    clearInterval(bootInterval);
  }, 1000);

  // ================================================================
  // PANEL
  // ================================================================
  function injectPanel() {
    const panel = document.createElement('div');
    panel.id = 'icu-panel';
    panel.innerHTML = `
      <div id="icu-header">
        📂 Chapter Uploader
        <button id="icu-minimize" title="Minimize">—</button>
      </div>
      <div id="icu-body">
        <p class="icu-hint">
          Click <strong>Create Chapter</strong> first, then load your <strong>.md</strong> files.
        </p>

        <label class="icu-label">Select .md files:</label>
        <input type="file" id="icu-file-input" accept=".md" multiple />
        <div id="icu-file-list"></div>

        <label class="icu-label">
          <input type="checkbox" id="icu-use-filename" checked />
          Use filename as chapter title
        </label>

        <label class="icu-label">
          Delay between chapters (ms):
          <input type="number" id="icu-delay" value="2000" min="800" max="15000" step="100" />
        </label>

        <div id="icu-actions">
          <button id="icu-debug-btn">🔍 Debug Editor</button>
          <button id="icu-fill-btn" disabled>⬇ Fill This Chapter Only</button>
          <button id="icu-auto-btn" disabled>▶ Auto-Upload All Chapters</button>
          <button id="icu-stop-btn" style="display:none">⏹ Stop After This Chapter</button>
        </div>

        <div id="icu-log-header" style="display:none">
          <span>Log</span>
          <button id="icu-copy-log">📋 Copy Log</button>
          <button id="icu-clear-log">✕ Clear</button>
        </div>
        <div id="icu-log"></div>
      </div>
    `;
    document.body.appendChild(panel);

    makeDraggable(panel, document.getElementById('icu-header'));
    document.getElementById('icu-minimize').addEventListener('click', toggleMinimize);
    document.getElementById('icu-file-input').addEventListener('change', onFilesSelected);
    document.getElementById('icu-debug-btn').addEventListener('click', runDebug);
    document.getElementById('icu-fill-btn').addEventListener('click', () => fillChapter());
    document.getElementById('icu-auto-btn').addEventListener('click', startAutoUpload);
    document.getElementById('icu-stop-btn').addEventListener('click', requestStop);
    document.getElementById('icu-copy-log').addEventListener('click', copyLog);
    document.getElementById('icu-clear-log').addEventListener('click', clearLog);
  }

  // ================================================================
  // DEBUG
  // ================================================================
  async function runDebug() {
    log('🔍 Debug check...');

    // 1. Check tinymce global
    if (typeof tinymce !== 'undefined') {
      log(`  ✅ window.tinymce found! Version: ${tinymce.majorVersion || '?'}`);
      const editors = tinymce.editors || [];
      log(`  editors: ${editors.length}`);
      if (tinymce.activeEditor) {
        log(`  activeEditor id: ${tinymce.activeEditor.id}`);
      } else {
        log(`  ⚠ activeEditor is null`);
      }
    } else {
      log('  ❌ window.tinymce NOT found');
    }

    // 2. Check for the iframe
    const iframe = document.querySelector('iframe.tox-edit-area__iframe');
    if (iframe) {
      log(`  ✅ TinyMCE iframe found: ${iframe.id}`);
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const body = iframeDoc.body;
        log(`  iframe body tag: ${body ? body.tagName : 'null'}`);
        log(`  iframe body contenteditable: ${body ? body.contentEditable : 'n/a'}`);
        log(`  iframe body text (first 50): "${body ? body.innerText.slice(0, 50) : ''}"`)
      } catch(e) {
        log(`  ❌ Cannot access iframe content: ${e.message}`);
      }
    } else {
      log('  ❌ TinyMCE iframe NOT found in DOM');
    }

    // 3. Check title field
    const titleEl = getTitleEl();
    log(`  Title field: ${titleEl ? '✅ found (' + titleEl.className + ')' : '❌ not found'}`);
  }

  // ================================================================
  // FILES
  // ================================================================
  function onFilesSelected(e) {
    files = Array.from(e.target.files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    currentIndex = 0;
    renderFileList();
    const hasFiles = files.length > 0;
    document.getElementById('icu-fill-btn').disabled = !hasFiles;
    document.getElementById('icu-auto-btn').disabled = !hasFiles;
    if (hasFiles) log(`✅ ${files.length} file(s) loaded.`);
  }

  function renderFileList() {
    const el = document.getElementById('icu-file-list');
    el.innerHTML = '';
    if (!files.length) { el.classList.remove('has-files'); return; }
    el.classList.add('has-files');
    files.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'icu-file-item' + (i === currentIndex ? ' active' : '');
      item.id = `icu-f-${i}`;
      item.textContent = `${i + 1}. ${f.name}`;
      el.appendChild(item);
    });
  }

  function markFileDone(index, success) {
    const el = document.getElementById(`icu-f-${index}`);
    if (el) { el.classList.remove('active'); el.classList.add(success ? 'done' : 'error'); }
  }

  function markFileActive(index) {
    document.querySelectorAll('.icu-file-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`icu-f-${index}`);
    if (el) el.classList.add('active');
  }

  // ================================================================
  // MARKDOWN
  // ================================================================
  function parseMarkdown(text) {
    const lines = text.split('\n');
    let title = '', bodyLines = [], found = false;
    for (const line of lines) {
      if (!found && line.startsWith('# ')) { title = line.replace(/^#\s+/, '').trim(); found = true; }
      else bodyLines.push(line);
    }
    while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
    return { title, body: bodyLines.join('\n').trim() };
  }

  function stripMarkdown(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*?\]\(.+?\)/g, '')
      .replace(/^>\s+/gm, '')
      .replace(/^---+$/gm, '')
      .trim();
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read: ' + file.name));
      reader.readAsText(file, 'UTF-8');
    });
  }

  // No HTML conversion needed — we paste as plain text to preserve formatting

  // ================================================================
  // TITLE
  // ================================================================
  function getTitleEl() {
    for (const sel of [
      '.input_title--plhUv',
      'input[placeholder="Title Here"]',
      'input[placeholder*="Title"]',
    ]) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function setTitle(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ================================================================
  // BODY — paste as plain text (matches Ctrl+Shift+V behavior)
  // ================================================================
  async function setBody(text) {
    // Strategy 1: Use TinyMCE's insertContent with plain text
    // This mirrors what Ctrl+Shift+V does — no HTML wrapping
    if (typeof tinymce !== 'undefined') {
      const ed = tinymce.activeEditor || (tinymce.editors && tinymce.editors[0]);
      if (ed) {
        try {
          // Select all and delete first to clear placeholder content
          ed.execCommand('selectAll');
          ed.execCommand('Delete');

          // Insert as plain text — TinyMCE will handle line breaks naturally
          // just like a plain text paste would
          ed.getBody().focus();

          const dt = new DataTransfer();
          dt.setData('text/plain', text);

          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });

          ed.getBody().dispatchEvent(pasteEvent);
          ed.fire('change');
          log('  📝 Body filled via plain text paste');
          return true;
        } catch (e) {
          log(`  ⚠ Plain text paste failed: ${e.message}, trying fallback...`);
        }

        // Fallback: insertContent as preformatted text
        try {
          ed.execCommand('selectAll');
          ed.execCommand('Delete');
          // Wrap in <pre> to preserve whitespace, then let TinyMCE normalize it
          ed.insertContent(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
          ed.fire('change');
          log('  📝 Body filled via insertContent fallback');
          return true;
        } catch (e) {
          log(`  ⚠ insertContent fallback failed: ${e.message}`);
        }
      }
    }

    // Strategy 2: paste directly into iframe body
    const iframe = document.querySelector('iframe.tox-edit-area__iframe');
    if (iframe) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const body = iframeDoc.body;
        if (body) {
          body.focus();
          iframeDoc.execCommand('selectAll', false, null);

          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });
          body.dispatchEvent(pasteEvent);
          log('  📝 Body filled via iframe paste');
          return true;
        }
      } catch (e) {
        log(`  ⚠ iframe paste failed: ${e.message}`);
      }
    }

    log('  ❌ All body fill strategies failed. Run 🔍 Debug Editor for details.');
    return false;
  }

  // ================================================================
  // PUBLISH / CONFIRM
  // ================================================================
  function clickPublish() {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim().toUpperCase() === 'PUBLISH');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }

  function clickConfirm() {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim().toUpperCase() === 'CONFIRM');
    if (btn) { btn.click(); return true; }
    return false;
  }

  function waitFor(fn, timeout = 8000, interval = 200) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (fn()) { clearInterval(t); resolve(); }
        else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout')); }
      }, interval);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ================================================================
  // FILL CHAPTER
  // ================================================================
  async function fillChapter() {
    if (!files.length || currentIndex >= files.length) { log('⚠ No files remaining.'); return false; }

    const file = files[currentIndex];
    log(`📄 Processing: ${file.name}`);

    let rawText;
    try { rawText = await readFileAsText(file); }
    catch (e) { log(`❌ Could not read file: ${e.message}`); return false; }

    const useFilename = document.getElementById('icu-use-filename').checked;
    const parsed = parseMarkdown(rawText);
    const title = useFilename ? file.name.replace(/\.md$/i, '') : (parsed.title || file.name.replace(/\.md$/i, ''));
    const body = stripMarkdown(parsed.body || rawText);

    // Title
    const titleEl = getTitleEl();
    if (!titleEl) { log('⚠ Title field not found. Are you on the chapter editor page?'); return false; }
    setTitle(titleEl, title);
    log(`  ✏ Title: "${title}"`);

    await sleep(400);

    // Body
    const ok = await setBody(body);
    if (!ok) return false;

    await sleep(300);
    return true;
  }

  // ================================================================
  // AUTO UPLOAD
  // ================================================================
  async function startAutoUpload() {
    if (!files.length) return;
    stopRequested = false;
    setButtons(true);
    log(`🚀 Auto-uploading ${files.length - currentIndex} chapter(s)...`);
    const delay = parseInt(document.getElementById('icu-delay').value) || 2000;

    while (currentIndex < files.length) {
      if (stopRequested) { log('⏹ Stopped.'); break; }
      markFileActive(currentIndex);

      const ok = await fillChapter();
      if (!ok) {
        markFileDone(currentIndex, false);
        currentIndex++;
        continue;
      }

      await sleep(600);

      log('  🔵 Clicking Publish...');
      if (!clickPublish()) {
        await sleep(1000);
        if (!clickPublish()) { log('  ❌ Publish button not found. Stopping.'); markFileDone(currentIndex, false); break; }
      }

      log('  ⏳ Waiting for confirm modal...');
      try {
        await waitFor(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim().toUpperCase() === 'CONFIRM'), 6000);
      } catch { log('  ❌ Confirm modal never appeared. Stopping.'); markFileDone(currentIndex, false); break; }

      await sleep(400);
      clickConfirm();
      markFileDone(currentIndex, true);
      log(`  🎉 "${files[currentIndex].name}" published!`);
      currentIndex++;

      if (currentIndex >= files.length) { log('🏁 All done!'); break; }
      if (stopRequested) { log('⏹ Stopped.'); break; }

      // Wait for page to return to novel overview
      log(`  ⏳ Waiting ${delay}ms for overview to load...`);
      await sleep(delay);

      // Click "Create Chapter" button
      log('  🆕 Clicking Create Chapter...');
      try {
        await waitFor(() => {
          const btn = Array.from(document.querySelectorAll('button, a'))
            .find(el => el.textContent.trim().toUpperCase().includes('CREATE CHAPTER'));
          if (btn) { btn.click(); return true; }
          return false;
        }, 8000);
      } catch {
        log('  ❌ "Create Chapter" button not found. Stopping.');
        break;
      }

      // Wait for the chapter editor to load (title field appears)
      log('  ⏳ Waiting for chapter editor to load...');
      try {
        await waitFor(() => {
          const t = getTitleEl();
          const iframe = document.querySelector('iframe.tox-edit-area__iframe');
          return t !== null && iframe !== null;
        }, 10000);
      } catch {
        log('  ⚠ Chapter editor did not load. Stopping.');
        break;
      }

      // Small extra pause to let TinyMCE fully initialize
      await sleep(800);
      log(`  ➡ Next: chapter ${currentIndex + 1}`);
    }

    setButtons(false);
  }

  function requestStop() { stopRequested = true; log('⏹ Stop requested...'); }

  function setButtons(running) {
    document.getElementById('icu-fill-btn').disabled = running;
    document.getElementById('icu-auto-btn').disabled = running;
    document.getElementById('icu-stop-btn').style.display = running ? 'block' : 'none';
  }

  // ================================================================
  // LOG
  // ================================================================
  function log(msg) {
    const el = document.getElementById('icu-log');
    const hdr = document.getElementById('icu-log-header');
    if (!el) return;
    el.classList.add('has-logs');
    hdr.style.display = 'flex';
    const line = document.createElement('div');
    line.className = 'icu-log-line';
    line.textContent = msg;
    line.title = 'Click to copy this line';
    line.addEventListener('click', () => {
      navigator.clipboard.writeText(msg).then(() => {
        line.classList.add('copied');
        setTimeout(() => line.classList.remove('copied'), 800);
      });
    });
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function copyLog() {
    const lines = Array.from(document.querySelectorAll('.icu-log-line')).map(l => l.textContent);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const btn = document.getElementById('icu-copy-log');
      btn.textContent = '✅ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy Log', 1500);
    });
  }

  function clearLog() {
    const el = document.getElementById('icu-log');
    el.innerHTML = '';
    el.classList.remove('has-logs');
    document.getElementById('icu-log-header').style.display = 'none';
  }

  // ================================================================
  // UI HELPERS
  // ================================================================
  function toggleMinimize() {
    const body = document.getElementById('icu-body');
    const btn = document.getElementById('icu-minimize');
    body.classList.toggle('hidden');
    btn.textContent = body.classList.contains('hidden') ? '＋' : '—';
  }

  function makeDraggable(panel, handle) {
    let sx, sy, sl, st;
    handle.addEventListener('mousedown', e => {
      sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect();
      sl = r.left; st = r.top;
      const move = e => {
        panel.style.left = (sl + e.clientX - sx) + 'px';
        panel.style.top = (st + e.clientY - sy) + 'px';
        panel.style.right = 'auto';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

})();
