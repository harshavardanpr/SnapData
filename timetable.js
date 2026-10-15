(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var file = null, imageUrl = null;

  function status(message, error) {
    var el = $('ttStatus');
    el.textContent = message;
    el.className = 'status' + (error ? ' err' : '');
  }
  function csvCell(value) {
    var s = String(value == null ? '' : value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function parseRows(text) {
    return text.split(/\r?\n/).map(function (line) {
      return line.split(/\t|\s{2,}/).map(function (cell) { return cell.trim(); });
    });
  }
  function copyText() {
    var text = $('ttOutput').value.trim();
    if (!text) { status('Read a timetable first.', true); return; }
    function fallback() {
      $('ttOutput').focus(); $('ttOutput').select();
      try { document.execCommand('copy'); status('Timetable copied.'); }
      catch (_) { status('Copy failed. Select the text and copy it manually.', true); }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { status('Timetable copied.'); }, fallback);
    } else fallback();
  }
  function exportCsv() {
    var text = $('ttOutput').value.trim();
    if (!text) { status('Read a timetable first.', true); return; }
    var rows = parseRows(text).map(function (row) { return row.map(csvCell).join(','); });
    var blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'snapdata-timetable.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status('Timetable CSV exported. Check the columns before using it.');
  }
  function wordRows(words) {
    var rows = [];
    (words || []).forEach(function (word) {
      var text = (word.text || '').trim();
      if (!text || !word.bbox) return;
      var top = word.bbox.y0, bottom = word.bbox.y1;
      var cy = (top + bottom) / 2, height = Math.max(1, bottom - top), row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(cy - rows[i].cy) < Math.max(10, height * .6)) { row = rows[i]; break; }
      }
      if (!row) { row = { cy: cy, words: [] }; rows.push(row); }
      row.words.push({ text: text, x0: word.bbox.x0, x1: word.bbox.x1, height: height });
    });
    rows.sort(function (a, b) { return a.cy - b.cy; });
    return rows.map(function (row) {
      row.words.sort(function (a, b) { return a.x0 - b.x0; });
      var cells = [], current = '', last = null, lastHeight = 0;
      row.words.forEach(function (word) {
        var gap = last === null ? 0 : word.x0 - last;
        var threshold = Math.max(28, Math.max(lastHeight, word.height) * 1.55);
        if (last !== null && gap > threshold) {
          cells.push(current.trim()); current = word.text;
        } else {
          current += (current ? ' ' : '') + word.text;
        }
        last = word.x1; lastHeight = word.height;
      });
      if (current.trim()) cells.push(current.trim());
      return cells.join('\t');
    }).filter(Boolean).join('\n');
  }

  $('ttImage').addEventListener('change', function () {
    var selected = this.files && this.files[0];
    this.value = '';
    if (!selected) return;
    if (!/^image\//.test(selected.type)) { status('Please choose an image file.', true); return; }
    file = selected;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    $('ttPreview').src = imageUrl;
    $('ttPreviewWrap').hidden = false;
    $('ttRead').disabled = false;
    $('ttOutputWrap').hidden = true;
    status('Timetable photo ready. Tap Read timetable.');
  });

  $('ttRead').addEventListener('click', function () {
    if (!file || typeof Tesseract === 'undefined') {
      status('OCR library is not ready. Check your internet connection and reload.', true);
      return;
    }
    var button = $('ttRead');
    button.disabled = true; button.textContent = 'Reading…';
    status('Reading timetable locally in your browser…');
    Tesseract.recognize(file, 'eng', {
      logger: function (progress) {
        if (progress.status === 'recognizing text') {
          status('Reading timetable… ' + Math.round(progress.progress * 100) + '%');
        }
      }
    }).then(function (result) {
      var structured = wordRows(result.data.words);
      var raw = (result.data.text || '').trim();
      $('ttOutput').value = structured || raw;
      $('ttOutputWrap').hidden = false;
      status($('ttOutput').value ? 'Done! Edit the text as needed. Tabs separate detected cells; review the timetable because OCR can miss or shift entries.' : 'No text found. Try a clearer, straighter photo.', !$('ttOutput').value);
    }).catch(function () {
      status('Could not read this photo. Try a sharper image with the timetable filling more of the frame.', true);
    }).finally(function () {
      button.disabled = false; button.textContent = 'Read timetable';
    });
  });
  $('ttCopy').addEventListener('click', copyText);
  $('ttCsv').addEventListener('click', exportCsv);
  $('ttClear').addEventListener('click', function () {
    file = null;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    $('ttPreview').removeAttribute('src');
    $('ttPreviewWrap').hidden = true;
    $('ttOutputWrap').hidden = true;
    $('ttOutput').value = '';
    $('ttRead').disabled = true;
    status('Cleared. Upload another timetable photo.');
  });
})();
