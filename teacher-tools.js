(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'snapdata.teacherTools.v1';
  var state = { timetable: [], marks: [], logs: [], notes: [], homework: [] };
  var editingHomework = null;
  function safeRead() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.timetable = Array.isArray(saved.timetable) ? saved.timetable : [];
      state.marks = Array.isArray(saved.marks) ? saved.marks : [];
      state.logs = Array.isArray(saved.logs) ? saved.logs : [];
      state.notes = Array.isArray(saved.notes) ? saved.notes : [];
      state.homework = Array.isArray(saved.homework) ? saved.homework : [];
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
  var WIDGET_KEY = 'snapdata.teacherWidgets.v1';
  var widgetDefaults = ['homework', 'tt-grid', 'files', 'worksheet', 'notes'];
  var widgetMeta = [
    { id: 'tt-grid', title: 'Timetable grid', description: 'Edit, import and export a timetable' },
    { id: 'files', title: 'Files library', description: 'Store, tag and download files on this device' },
    { id: 'marks', title: 'Marks', description: 'Enter marks and calculate totals' },
    { id: 'class-log', title: 'Class log', description: 'Record lessons and homework covered' },
    { id: 'homework', title: 'Homework dashboard', description: 'Track assignments and due dates' },
    { id: 'worksheet', title: 'Worksheet organiser', description: 'Split, edit and print questions' },
    { id: 'notes', title: 'Teacher notes', description: 'Save and organise teaching notes' },
    { id: 'backup', title: 'Privacy & backup', description: 'Export, import or clear local records' }
  ];
  var widgetLayout = { visible: widgetDefaults.slice(), order: widgetMeta.map(function (w) { return w.id; }), collapsed: [] };
  function readWidgetLayout() {
    try {
      var saved = JSON.parse(localStorage.getItem(WIDGET_KEY) || 'null');
      if (!saved || !Array.isArray(saved.visible) || !Array.isArray(saved.order)) return;
      widgetLayout.visible = widgetMeta.map(function (w) { return w.id; }).filter(function (id) { return saved.visible.indexOf(id) >= 0; });
      widgetLayout.order = saved.order.filter(function (id, i, arr) { return widgetMeta.some(function (w) { return w.id === id; }) && arr.indexOf(id) === i; });
      widgetMeta.forEach(function (w) { if (widgetLayout.order.indexOf(w.id) < 0) widgetLayout.order.push(w.id); });
      widgetLayout.collapsed = Array.isArray(saved.collapsed) ? saved.collapsed.filter(function (id) { return widgetMeta.some(function (w) { return w.id === id; }); }) : [];
      if (!widgetLayout.visible.length) widgetLayout.visible = ['homework'];
    } catch (_) {}
  }
  function saveWidgetLayout() {
    try { localStorage.setItem(WIDGET_KEY, JSON.stringify(widgetLayout)); return true; }
    catch (_) { status('teacherWidgetStatus', 'Could not save dashboard layout in this browser.', true); return false; }
  }
  function widgetElement(id) { return $('tool-' + id); }
  function applyWidgetLayout() {
    var grid = $('teacherWidgetGrid');
    widgetLayout.order.forEach(function (id) { var el = widgetElement(id); if (el) grid.appendChild(el); });
    widgetMeta.forEach(function (w) {
      var el = widgetElement(w.id); if (!el) return;
      el.hidden = widgetLayout.visible.indexOf(w.id) < 0;
      el.classList.add('teacher-widget'); el.setAttribute('data-widget', w.id);
      var heading = el.querySelector('h3');
      if (heading && !heading.parentElement.classList.contains('widget-heading')) {
        var header = document.createElement('div'); header.className = 'widget-heading';
        heading.parentNode.insertBefore(header, heading); header.appendChild(heading);
        var actions = document.createElement('div'); actions.className = 'widget-actions';
        actions.innerHTML = '<button class="btn sm widget-drag-handle" type="button" aria-label="Drag to rearrange ' + w.title + '" title="Drag to rearrange">⠿</button><button class="btn sm widget-move-up" type="button" aria-label="Move ' + w.title + ' earlier" title="Move earlier">↑</button><button class="btn sm widget-move-down" type="button" aria-label="Move ' + w.title + ' later" title="Move later">↓</button><button class="btn sm widget-collapse" type="button" aria-expanded="true">Collapse</button>';
        header.appendChild(actions);
      }
      var collapsed = widgetLayout.collapsed.indexOf(w.id) >= 0;
      Array.from(el.children).filter(function (child) { return !child.classList.contains('widget-heading'); }).forEach(function (child) { child.hidden = collapsed; });
      var collapse = el.querySelector('.widget-collapse');
      if (collapse) { collapse.textContent = collapsed ? 'Expand' : 'Collapse'; collapse.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); }
    });
    renderWidgetChoices();
  }
  function renderWidgetChoices() {
    var host = $('teacherWidgetChoices'); if (!host) return;
    host.innerHTML = widgetMeta.map(function (w) {
      var checked = widgetLayout.visible.indexOf(w.id) >= 0;
      return '<label class="widget-choice"><input type="checkbox" data-widget-choice="' + w.id + '"' + (checked ? ' checked' : '') + '><span><strong>' + esc(w.title) + '</strong><small>' + esc(w.description) + '</small></span></label>';
    }).join('');
    host.querySelectorAll('[data-widget-choice]').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-widget-choice');
        if (input.checked) { if (widgetLayout.visible.indexOf(id) < 0) widgetLayout.visible.push(id); }
        else {
          if (widgetLayout.visible.length <= 1) { input.checked = true; status('teacherWidgetStatus', 'Keep at least one widget on your dashboard.', true); return; }
          widgetLayout.visible = widgetLayout.visible.filter(function (x) { return x !== id; });
        }
        saveWidgetLayout(); applyWidgetLayout(); status('teacherWidgetStatus', 'Dashboard layout saved on this device.');
      });
    });
  }
  function initWidgetDashboard() {
    readWidgetLayout(); applyWidgetLayout();
    $('teacherWidgetGrid').addEventListener('click', function (event) {
      var btn = event.target.closest('button'); if (!btn) return;
      var widget = btn.closest('[data-widget]'); if (!widget) return;
      var id = widget.getAttribute('data-widget');
      if (btn.classList.contains('widget-collapse')) {
        if (widgetLayout.collapsed.indexOf(id) >= 0) widgetLayout.collapsed = widgetLayout.collapsed.filter(function (x) { return x !== id; });
        else widgetLayout.collapsed.push(id);
        saveWidgetLayout(); applyWidgetLayout();
      } else if (btn.classList.contains('widget-move-up') || btn.classList.contains('widget-move-down')) {
        var at = widgetLayout.order.indexOf(id), next = at + (btn.classList.contains('widget-move-up') ? -1 : 1);
        if (at < 0 || next < 0 || next >= widgetLayout.order.length) return;
        var temp = widgetLayout.order[at]; widgetLayout.order[at] = widgetLayout.order[next]; widgetLayout.order[next] = temp;
        saveWidgetLayout(); applyWidgetLayout();
      }
    });
    var dragState = null;
    $('teacherWidgetGrid').addEventListener('pointerdown', function (event) {
      var handle = event.target.closest('.widget-drag-handle');
      if (!handle || event.button > 0) return;
      var card = handle.closest('[data-widget]');
      if (!card || card.hidden) return;
      dragState = { card: card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
      handle.setPointerCapture && handle.setPointerCapture(event.pointerId);
      card.classList.add('widget-dragging');
      event.preventDefault();
    });
    document.addEventListener('pointermove', function (event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      if (Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY) > 5) dragState.moved = true;
      if (!dragState.moved) return;
      var target = document.elementFromPoint(event.clientX, event.clientY);
      var other = target && target.closest ? target.closest('#teacherWidgetGrid [data-widget]') : null;
      if (!other || other === dragState.card || other.hidden) return;
      var rect = other.getBoundingClientRect();
      var before = event.clientY < rect.top + rect.height / 2;
      if (before) other.parentNode.insertBefore(dragState.card, other);
      else other.parentNode.insertBefore(dragState.card, other.nextSibling);
    }, { passive: false });
    function finishWidgetDrag(event) {
      if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
      var moved = dragState.moved;
      dragState.card.classList.remove('widget-dragging');
      dragState = null;
      if (moved) {
        widgetLayout.order = Array.from($('teacherWidgetGrid').querySelectorAll('[data-widget]')).map(function (el) { return el.getAttribute('data-widget'); });
        saveWidgetLayout();
        status('teacherWidgetStatus', 'Dashboard layout saved. Your widget order is remembered on this device.');
      }
    }
    document.addEventListener('pointerup', finishWidgetDrag);
    document.addEventListener('pointercancel', finishWidgetDrag);
    if (window.SnapDataFileLibrary) window.SnapDataFileLibrary.initTeacherWidget();
    $('resetTeacherWidgets').addEventListener('click', function () {
      widgetLayout = { visible: widgetDefaults.slice(), order: widgetMeta.map(function (w) { return w.id; }), collapsed: [] };
      saveWidgetLayout(); applyWidgetLayout();
      status('teacherWidgetStatus', 'Dashboard layout reset. Your saved teacher records were not changed.');
    });
  }
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

  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function setHomeworkFormDefaults() {
    if (!$('hwAssigned')) return;
    $('hwAssigned').value = todayISO();
    $('hwDue').value = todayISO();
    $('hwClass').value = '';
    $('hwSubject').value = '';
    $('hwTitle').value = '';
    $('hwDetails').value = '';
    $('hwStatus').value = 'Assigned';
    editingHomework = null;
    $('hwFormHeading').textContent = 'Add homework';
    $('hwSave').textContent = 'Save homework';
    $('hwCancelEdit').hidden = true;
  }
  function renderHomework() {
    var today = todayISO();
    var soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 7);
    var soon = soonDate.getFullYear() + '-' + String(soonDate.getMonth() + 1).padStart(2, '0') + '-' + String(soonDate.getDate()).padStart(2, '0');
    var active = state.homework.filter(function (h) { return h.status === 'Assigned'; });
    $('hwActiveCount').textContent = active.length;
    $('hwSoonCount').textContent = active.filter(function (h) { return h.dueDate && h.dueDate >= today && h.dueDate <= soon; }).length;
    $('hwOverdueCount').textContent = active.filter(function (h) { return h.dueDate && h.dueDate < today; }).length;
    var classFilter = $('hwFilterClass').value.trim().toLowerCase();
    var query = $('hwSearch').value.trim().toLowerCase();
    var statusFilter = $('hwFilterStatus').value;
    var rows = state.homework.map(function (h, i) { return { h: h, i: i }; }).filter(function (entry) {
      var h = entry.h;
      if (classFilter && String(h.className).toLowerCase().indexOf(classFilter) < 0) return false;
      if (statusFilter === 'active' && h.status !== 'Assigned') return false;
      if (statusFilter !== 'active' && statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (query && [h.subject, h.title, h.details, h.className].join(' ').toLowerCase().indexOf(query) < 0) return false;
      return true;
    }).sort(function (a, b) {
      return String(a.h.dueDate || '9999-99-99').localeCompare(String(b.h.dueDate || '9999-99-99'));
    });
    $('hwAssignments').innerHTML = rows.length ? rows.map(function (entry) {
      var h = entry.h, i = entry.i;
      var overdue = h.status === 'Assigned' && h.dueDate && h.dueDate < today;
      var dueLabel = h.dueDate ? (overdue ? 'OVERDUE · ' : 'Due · ') + h.dueDate : 'No due date';
      return '<article class="saved-card homework-card"><div class="homework-card-top"><div><strong>' + esc(h.title) + '</strong><p class="hint">' + esc(h.className) + ' · ' + esc(h.subject) + '</p></div><span class="homework-status ' + (overdue ? 'overdue' : h.status === 'Completed' ? 'complete' : h.status === 'Cancelled' ? 'cancelled' : '') + '">' + esc(overdue ? 'Overdue' : h.status) + '</span></div><p><b>' + esc(dueLabel) + '</b> <span class="hint">· Assigned ' + esc(h.assignedDate || 'date unknown') + '</span></p>' + (h.details ? '<p>' + esc(h.details).replace(/\n/g, '<br>') + '</p>' : '') + '<div class="row wrap"><button class="btn sm" type="button" data-hw-edit="' + i + '">Edit</button>' + (h.status === 'Assigned' ? '<button class="btn sm" type="button" data-hw-complete="' + i + '">Mark completed</button>' : '') + '<button class="btn sm danger" type="button" data-hw-delete="' + i + '">Delete</button></div></article>';
    }).join('') : '<p class="empty">No matching homework yet. Add an assignment above to start your class record.</p>';
    $('hwAssignments').querySelectorAll('[data-hw-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = state.homework[Number(btn.dataset.hwEdit)];
        editingHomework = Number(btn.dataset.hwEdit);
        $('hwClass').value = h.className || ''; $('hwSubject').value = h.subject || '';
        $('hwTitle').value = h.title || ''; $('hwAssigned').value = h.assignedDate || today;
        $('hwDue').value = h.dueDate || ''; $('hwStatus').value = h.status || 'Assigned';
        $('hwDetails').value = h.details || ''; $('hwFormHeading').textContent = 'Edit homework';
        $('hwSave').textContent = 'Update homework'; $('hwCancelEdit').hidden = false;
        $('hwFormHeading').parentElement.open = true;
        $('hwClass').focus();
      });
    });
    $('hwAssignments').querySelectorAll('[data-hw-complete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = state.homework[Number(btn.dataset.hwComplete)];
        h.status = 'Completed'; persist(); renderHomework();
        status('hwStatusMessage', 'Assignment marked completed.');
      });
    });
    $('hwAssignments').querySelectorAll('[data-hw-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.dataset.hwDelete);
        if (confirm('Delete this homework assignment?')) {
          state.homework.splice(i, 1); persist(); renderHomework();
          status('hwStatusMessage', 'Homework deleted.');
        }
      });
    });
  }
  $('hwSave').addEventListener('click', function () {
    var entry = {
      className: $('hwClass').value.trim(), subject: $('hwSubject').value.trim(),
      title: $('hwTitle').value.trim(), assignedDate: $('hwAssigned').value,
      dueDate: $('hwDue').value, status: $('hwStatus').value,
      details: $('hwDetails').value.trim()
    };
    if (!entry.className || !entry.subject || !entry.title || !entry.assignedDate || !entry.dueDate) {
      status('hwStatusMessage', 'Please fill in class, subject, title, assigned date and due date.', true); return;
    }
    if (entry.dueDate < entry.assignedDate && !confirm('The due date is before the assigned date. Save anyway?')) return;
    if (editingHomework === null) state.homework.unshift(entry);
    else state.homework[editingHomework] = entry;
    if (persist()) {
      renderHomework(); setHomeworkFormDefaults();
      status('hwStatusMessage', 'Homework saved on this device.');
    }
  });
  $('hwCancelEdit').addEventListener('click', function () {
    setHomeworkFormDefaults(); status('hwStatusMessage', 'Edit cancelled.');
  });
  ['hwFilterClass', 'hwFilterStatus', 'hwSearch'].forEach(function (id) {
    $(id).addEventListener(id === 'hwFilterClass' || id === 'hwSearch' ? 'input' : 'change', renderHomework);
  });
  $('hwExport').addEventListener('click', function () {
    var rows = [['Class','Subject','Homework title','Instructions','Date assigned','Due date','Status']];
    state.homework.forEach(function (h) { rows.push([h.className,h.subject,h.title,h.details,h.assignedDate,h.dueDate,h.status]); });
    download('snapdata-homework.csv', '\ufeff' + csv(rows), 'text/csv;charset=utf-8');
    status('hwStatusMessage', 'Homework list exported as CSV.');
  });

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
    state.marks.forEach(function (r) { var raw = [r.maths, r.science, r.english]; var complete = raw.every(function (v) { return String(v == null ? '' : v).trim() !== '' && isFinite(Number(v)); }); var vals = raw.map(Number); var total = complete ? vals.reduce(function (a,b) { return a+b; },0) : ''; var percentage = complete ? (total/300*100).toFixed(2)+'%' : ''; rows.push([r.name,r.maths,r.science,r.english,total,percentage]); });
    copy(rows.map(function (r) { return r.join('\t'); }).join('\n'), function (ok) { status('marksStatus', ok ? 'Marks table copied.' : 'Copy failed; use Export CSV.', !ok); });
  });
  $('logDate').value = todayISO();
  $('logSave').addEventListener('click', function () {
    var log = { date: $('logDate').value, className: $('logClass').value.trim(), subject: $('logSubject').value.trim(), lesson: $('logLesson').value.trim(), homework: $('logHomework').value.trim(), notes: $('logNotes').value.trim() };
    if (!log.date || !log.className || !log.subject || !log.lesson) { status('logStatus', 'Please enter the date, class, subject and lesson covered.', true); return; }
    state.logs.unshift(log); if (persist()) { renderLogs(); status('logStatus', 'Class log entry saved.'); ['logClass','logSubject','logLesson','logHomework','logNotes'].forEach(function (id) { $(id).value = ''; }); } else { state.logs.shift(); }
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
        if (!data || !Array.isArray(data.timetable) || !Array.isArray(data.marks) || !Array.isArray(data.logs) || !Array.isArray(data.notes) || (data.homework !== undefined && !Array.isArray(data.homework))) throw new Error('Invalid backup');
        if (!confirm('Importing replaces the current teacher-tool data on this device. Continue?')) return;
        state = { timetable: data.timetable, marks: data.marks, logs: data.logs, notes: data.notes, homework: Array.isArray(data.homework) ? data.homework : [] };
        persist(); renderGrid(state.timetable); renderMarks(); renderLogs(); renderNotes(); renderHomework();
        status('backupStatus', 'Backup imported.');
      } catch (_) { status('backupStatus', 'That file is not a valid SnapData teacher-tool backup.', true); }
    };
    reader.readAsText(file);
  });
  $('backupClear').addEventListener('click', function () {
    if (!confirm('Delete all timetable, marks, class log, homework and teacher notes saved by these teacher tools on this device? This cannot be undone.')) return;
    state = { timetable: [], marks: [], logs: [], notes: [], homework: [] }; localStorage.removeItem(KEY);
    renderGrid([]); renderMarks(); renderLogs(); renderNotes(); renderHomework(); setHomeworkFormDefaults(); status('backupStatus', 'Teacher-tool data cleared from this browser.');
  });
  $('showInstallHelp').addEventListener('click', function () {
    alert(/android/i.test(navigator.userAgent) ? 'Android: open SnapData in Chrome, tap ⋮, then choose Install app or Add to Home screen.' : 'Open your browser menu and choose Install SnapData or Add to Home Screen. Availability depends on your browser.');
  });
  safeRead();
  renderGrid(state.timetable);
  renderMarks();
  renderLogs();
  renderNotes();
  setHomeworkFormDefaults();
  renderHomework();
  initWidgetDashboard();
})();