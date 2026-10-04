(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var items = [], history = [], uid = 0, file = null, busy = false;

  var NUM = /^[-+(]?[$€£¥₹]?\s*-?\d[\d,]*(\.\d+)?\s*%?\)?$|^[-+]?\.\d+$/;
  function isNum(t) { return NUM.test(t.trim()); }
  function toNum(t) {
    var s = t.trim(), neg = /^\(.*\)$/.test(s);
    var n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
    return neg ? -Math.abs(n) : n;
  }
  function fmt(n) { return String(Math.round(n * 1e10) / 1e10); }
  function hasDigit(t) { return /\d/.test(t); }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function setStatus(msg, err) { var s = $('status'); s.textContent = msg; s.className = 'status' + (err ? ' err' : ''); }

  function snapshot() {
    history.push(JSON.stringify(items)); if (history.length > 30) history.shift();
    $('undo').disabled = false;
  }
  function add(text, o) { items.push({ id: ++uid, text: text, sel: false, o: o == null ? uid : o }); }

  /* ---------- image handling ---------- */
  function onFile(e) {
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setStatus('Please choose an image file.', true); return; }
    file = f;
    $('preview').src = URL.createObjectURL(f);
    $('previewWrap').hidden = false;
    $('extractBtn').disabled = false; $('clearImg').disabled = false;
    setStatus('Image ready. Choose Extract data.');
  }
  function clearImage() {
    file = null; $('preview').removeAttribute('src'); $('previewWrap').hidden = true;
    $('extractBtn').disabled = true; $('clearImg').disabled = true;
    $('bar').hidden = true; setStatus('');
  }
  // Downscale big phone photos so OCR is faster and uses less memory.
  function prepare(f) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var max = 2200, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || f); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(f); };
      img.src = url;
    });
  }

  /* ---------- OCR ---------- */
  function extract() {
    if (!file || busy) return;
    if (typeof Tesseract === 'undefined') { setStatus('OCR library failed to load. Check your internet connection and reload.', true); return; }
    busy = true; $('extractBtn').disabled = true;
    var bar = $('bar'); bar.hidden = false; bar.value = 0;
    setStatus('Preparing image…');
    prepare(file).then(function (img) {
      return Tesseract.recognize(img, 'eng', {
        logger: function (m) {
          if (m.status === 'recognizing text') { bar.value = Math.round(m.progress * 100); setStatus('Reading text… ' + bar.value + '%'); }
          else if (m.status) { setStatus(m.status.charAt(0).toUpperCase() + m.status.slice(1) + '…'); }
        }
      });
    }).then(function (r) {
      var lines = (r.data.text || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+$/, '').trim(); }).filter(Boolean);
      if (!lines.length) { setStatus('No text found. Try a sharper, well-lit photo.', true); return; }
      snapshot();
      lines.forEach(function (l) { add(l); });
      setStatus('Found ' + lines.length + ' lines. Edit, filter or export below.');
      render();
    }).catch(function (err) {
      setStatus('Could not read the image: ' + (err && err.message ? err.message : 'unknown error'), true);
    }).then(function () {
      busy = false; $('extractBtn').disabled = !file; bar.hidden = true;
    });
  }

  /* ---------- view ---------- */
  function visible() {
    var f = $('filter').value, q = $('search').value.trim().toLowerCase();
    return items.filter(function (it) {
      if (f === 'num' && !isNum(it.text)) return false;
      if (f === 'txt' && hasDigit(it.text)) return false;
      if (q && it.text.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function render() {
    var list = $('list'), vis = visible();
    list.innerHTML = '';
    vis.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'item' + (it.sel ? ' sel' : '') + (isNum(it.text) ? ' isnum' : '');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = it.sel; cb.setAttribute('aria-label', 'Select item');
      cb.onchange = function () { it.sel = cb.checked; li.classList.toggle('sel', it.sel); stats(); };
      var tx = document.createElement('input'); tx.type = 'text'; tx.value = it.text; tx.setAttribute('aria-label', 'Edit item');
      tx.oninput = function () { it.text = tx.value; li.classList.toggle('isnum', isNum(it.text)); stats(); };
      var del = document.createElement('button'); del.className = 'x'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete item');
      del.onclick = function () { snapshot(); items = items.filter(function (i) { return i !== it; }); render(); };
      li.appendChild(cb); li.appendChild(tx); li.appendChild(del); list.appendChild(li);
    });
    $('empty').hidden = items.length > 0;
    stats();
  }
  function stats() {
    var sel = items.filter(function (i) { return i.sel; });
    var nums = sel.filter(function (i) { return isNum(i.text); }).map(function (i) { return toNum(i.text); });
    $('count').textContent = items.length ? (visible().length + ' shown of ' + items.length + ' items, ' + sel.length + ' selected') : 'No data yet.';
    if (nums.length) {
      var sum = nums.reduce(function (a, b) { return a + b; }, 0);
      $('sums').textContent = nums.length + ' numbers selected. Total ' + fmt(sum) + ', average ' + fmt(sum / nums.length) + ', min ' + fmt(Math.min.apply(null, nums)) + ', max ' + fmt(Math.max.apply(null, nums));
    } else { $('sums').textContent = 'Select numbers to see their total.'; }
  }

  /* ---------- organise ---------- */
  function sortItems() {
    var m = $('sort').value;
    var byNum = function (a, b) {
      var an = isNum(a.text), bn = isNum(b.text);
      if (an && bn) return toNum(a.text) - toNum(b.text);
      return an ? -1 : bn ? 1 : 0;
    };
    snapshot();
    items.sort(function (a, b) {
      if (m === 'az') return a.text.localeCompare(b.text, undefined, { numeric: true });
      if (m === 'za') return b.text.localeCompare(a.text, undefined, { numeric: true });
      if (m === 'lo') return byNum(a, b);
      if (m === 'hi') { var an = isNum(a.text), bn = isNum(b.text); return an && bn ? toNum(b.text) - toNum(a.text) : an ? -1 : bn ? 1 : 0; }
      return a.o - b.o;
    });
    render();
  }
  function splitCells() {
    var src = items.filter(function (i) { return i.sel; });
    if (!src.length) src = items.slice();
    if (!src.length) return;
    snapshot();
    var out = [];
    items.forEach(function (it) {
      if (src.indexOf(it) < 0) { out.push(it); return; }
      it.text.split(/\t|\||\s{2,}|\s+/).filter(Boolean).forEach(function (c) {
        out.push({ id: ++uid, text: c, sel: it.sel, o: it.o });
      });
    });
    items = out; render(); toast('Split into cells');
  }
  function dedupe() {
    snapshot(); var seen = {};
    items = items.filter(function (i) { var k = i.text.trim().toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
    render();
  }
  function deleteSelected() {
    if (!items.some(function (i) { return i.sel; })) { toast('Nothing selected'); return; }
    snapshot(); items = items.filter(function (i) { return !i.sel; }); render();
  }
  function undo() {
    if (!history.length) return;
    items = JSON.parse(history.pop()); $('undo').disabled = !history.length; render();
  }

  /* ---------- calculate ---------- */
  function calc() {
    var v = parseFloat($('val').value), op = $('op').value;
    if (isNaN(v)) { toast('Enter a value first'); return; }
    if (op === '/' && v === 0) { toast('Cannot divide by zero'); return; }
    var t = items.filter(function (i) { return i.sel && isNum(i.text); });
    if (!t.length) { toast('Select some numbers first'); return; }
    snapshot();
    t.forEach(function (i) {
      var n = toNum(i.text);
      i.text = fmt(op === '+' ? n + v : op === '-' ? n - v : op === '*' ? n * v : n / v);
    });
    render(); toast('Updated ' + t.length + ' numbers');
  }

  /* ---------- copy / export ---------- */
  function pick(selectedOnly) {
    var s = items.filter(function (i) { return i.sel; });
    return selectedOnly ? s : (s.length ? s : items);
  }
  function copy(selectedOnly) {
    var list = selectedOnly ? pick(true) : items;
    if (!list.length) { toast(selectedOnly ? 'Nothing selected' : 'Nothing to copy'); return; }
    var text = list.map(function (i) { return i.text; }).join('\n');
    var done = function () { toast('Copied ' + list.length + ' items'); };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function download(name, mime, content) {
    var b = new Blob([content], { type: mime + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csvCell(s) { return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function exportData(kind) {
    var list = pick(false);
    if (!list.length) { toast('Nothing to export'); return; }
    if (kind === 'txt') { download('snapdata.txt', 'text/plain', list.map(function (i) { return i.text; }).join('\n')); }
    else {
      var rows = list.map(function (i) {
        var cells = i.text.split(/\t|\||\s{2,}/).map(function (c) { return c.trim(); }).filter(Boolean);
        return (cells.length ? cells : [i.text]).map(csvCell).join(',');
      });
      download('snapdata.csv', 'text/csv', '\ufeff' + rows.join('\r\n'));
    }
    toast('Exported ' + list.length + ' items');
  }

  /* ---------- wire up ---------- */
  $('cam').onchange = onFile; $('up').onchange = onFile;
  $('extractBtn').onclick = extract; $('clearImg').onclick = clearImage;
  $('filter').onchange = render; $('sort').onchange = sortItems;
  $('search').oninput = render;
  $('selAll').onclick = function () { visible().forEach(function (i) { i.sel = true; }); render(); };
  $('selNone').onclick = function () { items.forEach(function (i) { i.sel = false; }); render(); };
  $('addItem').onclick = function () {
    snapshot(); add(''); render();
    var inputs = $('list').querySelectorAll('input[type=text]');
    if (inputs.length) { var l = inputs[inputs.length - 1]; l.scrollIntoView({ block: 'nearest' }); l.focus(); }
  };
  $('split').onclick = splitCells; $('dedupe').onclick = dedupe;
  $('delSel').onclick = deleteSelected; $('undo').onclick = undo;
  $('applyCalc').onclick = calc;
  $('copySel').onclick = function () { copy(true); };
  $('copyAll').onclick = function () { copy(false); };
  $('expTxt').onclick = function () { exportData('txt'); };
  $('expCsv').onclick = function () { exportData('csv'); };
  render();
})();
