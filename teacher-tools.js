(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'snapdata.teacherTools.v1';
  var state = { timetable: [], marks: [], logs: [], notes: [] };
  function safeRead() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.timetable = Array.isArray(saved.timetable) ? saved.timetable : [];
      state.marks = Array.isArray(saved.marks) ? saved.marks : [];
      state.logs = Array.isArray(saved.logs) ? saved.logs : [];
      state.notes = Array.isArray(saved.notes) ? saved.notes : [];
    } catch (_) {}
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { alert('Could not save locally. Your browser storage may be full or disabled. Export a backup instead.'); return false; }
  }
  function status(id, message, error) {
    var el = $(id); if (!el) return;
    el.textContent = message; el.className = 'status' + (error ? ' err' : '');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function download(name, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }
  function csv(rows) {
    return rows.map(function (row) {
      return row.map(function (v) { var s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\r\n');
  }
  function copy(text, onDone) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { onDone(true); }, function () { onDone(false); });
    } else {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove(); onDone(ok);
    }
  }
  function parseTsv(text) {
    return String(text || '').replace(/\r/g, '').split('\n').filter(function (line) { return line.trim() !== ''; })
      .map(function (line) { return line.split('\t'); });
  }
  function showTool(name) {
    document.querySelectorAll('.teacher-tool').forEach(function (el) { el.hidden = el.id !== 'tool-' + name; });
    document.querySelectorAll('[data-tool]').forEach(function (el) {
      var active = el.getAttribute('data-tool') === name;
      el.classList.toggle('active', active); el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  document.querySelectorAll('[data-tool]').forEach(function (el) {
    el.addEventListener('click', function () { showTool(el.getAttribute('data-tool')); });
  });
  function renderGrid(rows) {
    var host = $('ttGrid');
    if (!rows.length) rows = [['Day', 'Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'], ['Monday', '', '', '', '', ''], ['Tuesday', '', '', '', '', ''], ['Wednesday', '', '', '', '', ''], ['Thursday', '', '', '', '', ''], ['Friday', '', '', '', '', '']];
    host.innerHTML = '<table><tbody>' + rows.map(function (row, ri) {
      return '<tr>' + row.map(function (cell, ci) {
        return '<td contenteditable="true" role="textbox" aria-label="Row ' + (ri + 1) + ', column ' + (ci + 1) + '" data-r="' + ri + '" data-c="' + ci + '">' + esc(cell) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }
  function readGrid() {
    return Array.from($('ttGrid').querySelectorAll('tr')).map(function (tr) {
      return Array.from(tr.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); });
    });
  }
  function gridText() { return readGrid().map(function (row) { return row.join('\t'); }).join('\n'); }
  function renderMarks() {
    var rows = state.marks;
    if (!rows.length) rows = [
      { name: 'Student', maths: '', science: '', english: '' }
    ];
    var html = '<table><thead><tr><th>Learner name</th><th>Maths /100</th><th>Science /100</th><th>English /100</th><th>Total /300</th><th>Percentage</th><th>Check</th></tr></thead><tbody>';
    rows.forEach(function (row, i) {
      var vals = ['maths', 'science', 'english'].map(function (k) { return row[k] === '' ? null : Number(row[k]); });
      var total = vals.every(function (v) { return v !== null && Number.isFinite(v); }) ? vals.reduce(function (a, b) { return a + b; }, 0) : null;
      var invalid = vals.some(function (v) { return v !== null && (!Number.isFinite(v) || v < 0 || v > 100); });
      html += '<tr data-index="' + i + '"><td><input data-field="name" aria-label="Learner name row ' + (i + 1) + '" value="' + esc(row.name) + '"></td>';
      ['maths', 'science', 'english'].forEach(function (k) {
        html += '<td><input type="number" min="0" max="100" step="any" data-field="' + k + '" aria-label="' + k + ' mark row ' + (i + 1) + '" value="' + esc(row[k]) + '"></td>';
      });
      html += '<td>' + (total === null ? '—' : total) + '</td><td>' + (total === null ? '—' : (total / 300 * 100).toFixed(2) + '%') + '</td><td class="' + (invalid ? 'err' : '') + '">' + (invalid ? 'Check 0–100' : vals.some(function (v) { return v === null; }) ? 'Incomplete' : 'OK') + '</td></tr>';
    });
    html += '</tbody></table>';
    $('marksGrid').innerHTML = html;
  }
  function readMarks() {
    state.marks = Array.from($('marksGrid').querySelectorAll('tbody tr')).map(function (tr) {
      var row = { name: '', maths: '', science: '', english: '' };
      tr.querySelectorAll('input').forEach(function (input) { row[input.dataset.field] = input.value.trim(); });
      return row;
    });
  }
  function renderLogs() {
    $('logEntries').innerHTML = state.logs.length ? state.logs.map(function (log, i) {
      return '<article class="saved-card"><strong>' + esc(log.date) + ' · ' + esc(log.className) + ' · ' + esc(log.subject) + '</strong><p><b>Lesson:</b> ' + esc(log.lesson) + '</p><p><b>Homework:</b> ' + esc(log.homework) + '</p><p>' + esc(log.notes) + '</p><button class="btn sm danger" data-log-delete="' + i + '">Delete entry</button></article>';
    }).join('') : '<p class="empty">No class log entries yet.</p>';
    $('logEntries').querySelectorAll('[data-log-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.dataset.logDelete);
        if (confirm('Delete this class log entry?')) { state.logs.splice(i, 1); persist(); renderLogs(); }
      });
    });
  }
  function renderNotes() {
    $('noteOutput').innerHTML = state.notes.length ? state.notes.map(function (note, i) {
      return '<article class="saved-card"><strong>' + esc(note.topic || 'Untitled note') + '</strong><p class="hint">' + esc(note.subject) + ' · ' + esc(note.date) + '</p><p>' + esc(note.body).replace(/\n/g, '<br>') + '</p><button class="btn sm" data-note-load="' + i + '">Edit</button> <button class="btn sm danger" data-note-delete="' + i + '">Delete</button></article>';
    }).join('') : '<p class="empty">No saved notes yet.</p>';
    $('noteOutput').querySelectorAll('[data-note-load]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = state.notes[Number(btn.dataset.noteLoad)];
        $('noteSubject').value = n.subject; $('noteTopic').value = n.topic; $('noteBody').value = n.body;
        state.notes.splice(Number(btn.dataset.noteLoad), 1); persist(); renderNotes(); $('noteBody').focus();
      });
    });
    $('noteOutput').querySelectorAll('[data-note-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Delete this note?')) { state.notes.splice(Number(btn.dataset.noteDelete), 1); persist(); renderNotes(); }
      });
    });
  }
  $('gridFromTT').addEventListener('click', function () {
    var text = $('ttOutput') ? $('ttOutput').value : '';
    if (!text.trim()) { status('gridStatus', 'No text found in TT Copier yet. Open the TT Copier page and read or paste a timetable first.', true); return; }
    renderGrid(parseTsv(text)); status('gridStatus', 'Imported timetable text. Review and edit each cell, then save.');
  });
  $('gridBlank').addEventListener('click', function () { renderGrid([]); status('gridStatus', 'Blank timetable ready.'); });
  $('gridAddRow').addEventListener('click', function () {
    var rows = readGrid(), cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    rows.push(Array(cols).fill('')); renderGrid(rows);
  });
  $('gridAddCol').addEventListener('click', function () {
    var rows = readGrid(); if (!rows.length) rows = [['']];
    rows.forEach(function (r) { r.push(''); }); renderGrid(rows);
  });
  $('gridSave').addEventListener('click', function () {
    state.timetable = readGrid(); if (persist()) status('gridStatus', 'Timetable saved on this device.');
  });
  $('gridCsv').addEventListener('click', function () { download('snapdata-timetable.csv', '\ufeff' + csv(readGrid()), 'text/csv;charset=utf-8'); status('gridStatus', 'Timetable CSV exported.'); });
  $('gridCopy').addEventListener('click', function () { copy(gridText(), function (ok) { status('gridStatus', ok ? 'Timetable copied as TSV.' : 'Copy was blocked. Select the grid cells and copy manually.', !ok); }); });
  $('marksGrid').addEventListener('change', function (event) {
    if (!event.target.matches('input')) return;
    readMarks(); renderMarks();
  });
  $('marksAdd').addEventListener('click', function () { readMarks(); state.marks.push({ name: '', maths: '', science: '', english: '' }); renderMarks(); });
  $('marksSave').addEventListener('click', function () { readMarks(); if (persist()) status('marksStatus', 'Marks saved on this device.'); });
  $('marksCsv').addEventListener('click', function () {
    readMarks();
    var rows = [['Learner name', 'Maths /100', 'Science /100', 'English /100', 'Total /300', 'Percentage', 'Validation']];
    state.marks.forEach(function (r) {
      var vals = [r.maths, r.science, r.english].map(function (v) { return v === '' ? null : Number(v); });
      var total = vals.every(function (v) { return v !== null && Number.isFinite(v) && v >= 0 && v <= 100; }) ? vals.reduce(function (a, b) { return a + b; }, 0) : '';
      rows.push([r.name, r.maths, r.science, r.english, total, total === '' ? '' : (total / 300 * 100).toFixed(2) + '%', total === '' ? 'Check marks' : 'OK']);
    });
    download('snapdata-marks.csv', '\ufeff' + csv(rows), 'text/csv;charset=utf-8');
  });
  $('marksCopy').addEventListener('click', function () {
    readMarks(); var rows = [['Learner name', 'Maths /100', 'Science /100', 'English /100', 'Total /300', 'Percentage']];
    state.marks.forEach(function (r) { var vals = [r.maths, r.science, r.english].map(Number); var total = vals.reduce(function (a,b) { return a+b; },0); rows.push([r.name,r.maths,r.science,r.english,total,(total/300*100).toFixed(2)+'%']); });
    copy(rows.map(function (r) { return r.join('\t'); }).join('\n'), function (ok) { status('marksStatus', ok ? 'Marks table copied.' : 'Copy failed; use Export CSV.', !ok); });
  });
  $('logDate').value = new Date().toISOString().slice(0, 10);
  $('logSave').addEventListener('click', function () {
    var log = { date: $('logDate').value, className: $('logClass').value.trim(), subject: $('logSubject').value.trim(), lesson: $('logLesson').value.trim(), homework: $('logHomework').value.trim(), notes: $('logNotes').value.trim() };
    if (!log.date || !log.className || !log.subject || !log.lesson) { status('backupStatus', ''); alert('Please enter the date, class, subject and lesson covered.'); return; }
    state.logs.unshift(log); if (persist()) { renderLogs(); ['logClass','logSubject','logLesson','logHomework','logNotes'].forEach(function (id) { $(id).value = ''; }); }
  });
  $('logExport').addEventListener('click', function () {
    download('snapdata-class-log.csv', '\ufeff' + csv([['Date','Class','Subject','Lesson','Homework','Notes']].concat(state.logs.map(function (l) { return [l.date,l.className,l.subject,l.lesson,l.homework,l.notes]; }))), 'text/csv;charset=utf-8');
  });
  $('worksheetSplit').addEventListener('click', function () {
    var text = $('worksheetInput').value.trim();
    if (!text) { $('worksheetOutput').innerHTML = '<p class="empty">Paste or type some questions first.</p>'; return; }
    var parts = text.split(/(?=(?:^|\n)\s*(?:(?:Q(?:uestion)?\s*)?\d{1,3}[.)]|[A-H][.)]|\([a-h1-9]\))\s*)/i).map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length <= 1) parts = text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    $('worksheetOutput').innerHTML = parts.map(function (part, i) { return '<label class="question-card"><span>Question ' + (i + 1) + '</span><textarea rows="3" data-question="' + i + '">' + esc(part) + '</textarea></label>'; }).join('');
  });
  $('worksheetCopy').addEventListener('click', function () {
    var fields = Array.from($('worksheetOutput').querySelectorAll('textarea'));
    var text = fields.length ? fields.map(function (f, i) { return (i + 1) + '. ' + f.value.trim(); }).join('\n\n') : $('worksheetInput').value;
    copy(text, function (ok) { if (!ok) alert('Copy was blocked. Select the text and copy manually.'); });
  });
  $('worksheetPrint').addEventListener('click', function () { window.print(); });
  $('noteSave').addEventListener('click', function () {
    var body = $('noteBody').value.trim();
    if (!body) { alert('Enter some notes first.'); return; }
    state.notes.unshift({ subject: $('noteSubject').value.trim(), topic: $('noteTopic').value.trim(), body: body, date: new Date().toLocaleDateString() });
    if (persist()) { renderNotes(); $('noteBody').value = ''; $('noteTopic').value = ''; }
  });
  $('noteSummarise').addEventListener('click', function () {
    var text = $('noteBody').value.trim();
    if (!text) { alert('Enter or paste notes first.'); return; }
    var sentences = text.split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var points = sentences.filter(function (s, i) { return i === 0 || /\b(important|because|therefore|must|key|main|first|second|finally|result|means|causes?)\b/i.test(s); }).slice(0, 8);
    if (!points.length) points = sentences.slice(0, 5);
    $('noteBody').value = points.map(function (s) { return '• ' + s; }).join('\n');
    status('backupStatus', 'Key points created locally from your notes.');
  });
  $('noteCopy').addEventListener('click', function () { copy($('noteBody').value, function (ok) { if (!ok) alert('Copy failed.'); }); });
  $('backupExport').addEventListener('click', function () {
    readMarks(); state.timetable = readGrid();
    download('snapdata-teacher-backup.json', JSON.stringify({ schema: 1, exportedAt: new Date().toISOString(), data: state }, null, 2), 'application/json;charset=utf-8');
    status('backupStatus', 'Teacher-tool backup exported as JSON.');
  });
  $('backupImport').addEventListener('change', function () {
    var file = this.files && this.files[0]; this.value = ''; if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var backup = JSON.parse(reader.result), data = backup.data || backup;
        if (!data || !Array.isArray(data.timetable) || !Array.isArray(data.marks) || !Array.isArray(data.logs) || !Array.isArray(data.notes)) throw new Error('Invalid backup');
        if (!confirm('Importing replaces the current teacher-tool data on this device. Continue?')) return;
        state = { timetable: data.timetable, marks: data.marks, logs: data.logs, notes: data.notes };
        persist(); renderGrid(state.timetable); renderMarks(); renderLogs(); renderNotes();
        status('backupStatus', 'Backup imported.');
      } catch (_) { status('backupStatus', 'That file is not a valid SnapData teacher-tool backup.', true); }
    };
    reader.readAsText(file);
  });
  $('backupClear').addEventListener('click', function () {
    if (!confirm('Delete all timetable, marks, class log and teacher notes saved by these teacher tools on this device? This cannot be undone.')) return;
    state = { timetable: [], marks: [], logs: [], notes: [] }; localStorage.removeItem(KEY);
    renderGrid([]); renderMarks(); renderLogs(); renderNotes(); status('backupStatus', 'Teacher-tool data cleared from this browser.');
  });
  $('showInstallHelp').addEventListener('click', function () {
    alert(/android/i.test(navigator.userAgent) ? 'Android: open SnapData in Chrome, tap ⋮, then choose Install app or Add to Home screen.' : 'Open your browser menu and choose Install SnapData or Add to Home Screen. Availability depends on your browser.');
  });
  safeRead();
  renderGrid(state.timetable);
  renderMarks();
  renderLogs();
  renderNotes();
  showTool('tt-grid');
})();