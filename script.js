  function prepare(f) {
    var c=renderCanvas();if(!c)return Promise.resolve(f);var max=2200,scale=Math.min(1,max/Math.max(c.width,c.height)),o=document.createElement('canvas');o.width=Math.round(c.width*scale);o.height=Math.round(c.height*scale);var x=o.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,o.width,o.height);x.drawImage(c,0,0,o.width,o.height);return new Promise(function(res){o.toBlob(function(b){res(b||f)},'image/png')});
  }
  function tileCanvases(c){var max=2200,over=.12;if(Math.max(c.width,c.height)<=max)return [c];var long=Math.max(c.width,c.height),n=Math.ceil(long/(max*(1-over))),out=[],vertical=c.height>c.width,step=(vertical?c.height:c.width)/n;for(var i=0;i<n;i++){var st=Math.max(0,Math.round(i*step-step*over)),en=Math.min(vertical?c.height:c.width,Math.round((i+1)*step+step*over)),tw=vertical?c.width:en-st,th=vertical?en-st:c.height,t=document.createElement('canvas');t.width=tw;t.height=th;t.getContext('2d').drawImage(c,vertical?0:st,vertical?st:0,tw,th,0,0,tw,th);out.push(t)}return out}
  function rowsFromWords(words){var rows=[];words.forEach(function(w){var t=(w.text||'').trim();if(!t)return;var cy=(w.bbox.y0+w.bbox.y1)/2,row=null;for(var i=0;i<rows.length;i++)if(Math.abs(cy-rows[i].cy)<Math.max(12,(w.bbox.y1-w.bbox.y0)*.65)){row=rows[i];break}if(!row){row={cy:cy,words:[]};rows.push(row)}row.words.push(w)});rows.sort(function(a,b){return a.cy-b.cy});return rows.map(function(row){row.words.sort(function(a,b){return a.bbox.x0-b.bbox.x0});var out='',last=null;row.words.forEach(function(w){if(last!==null&&w.bbox.x0-last>Math.max(18,(w.bbox.y1-w.bbox.y0)*1.5))out+='\t';else if(out)out+=' ';out+=(w.text||'').trim();last=w.bbox.x1});return out.trim()}).filter(Boolean)}
  function extract(){
    if(!file||busy)return;if(typeof Tesseract==='undefined'){setStatus('OCR library failed to load. Check your internet connection and reload.',true);return}
    busy=true;$('extractBtn').disabled=true;var bar=$('bar');bar.hidden=false;bar.value=0;setStatus('Preparing image…');
    var modeChoice=$('ocrMode').value,quality=$('quality').value,kind=modeChoice==='auto'?'table':modeChoice;
    prepare(file).then(function(base){var canvas=document.createElement('canvas'),im=new Image();im.src=URL.createObjectURL(base);return new Promise(function(resolve){im.onload=function(){canvas.width=im.width;canvas.height=im.height;canvas.getContext('2d').drawImage(im,0,0);resolve(canvas)}})}).then(function(c){
      var tiles=quality==='high'?tileCanvases(c):[c],results=[],idx=0;
      function next(){if(idx>=tiles.length){finish();return}setStatus('Reading section '+(idx+1)+' of '+tiles.length+'…');var cfg={logger:function(m){if(m.status==='recognizing text'){bar.value=Math.round(((idx+m.progress)/tiles.length)*100);setStatus('Reading text… '+bar.value+'%')}}};if(kind==='numbers')cfg.config={tessedit_char_whitelist:'0123456789.,%$€£¥₹-+()'};Tesseract.recognize(tiles[idx],'eng',cfg).then(function(r){results.push(r);idx++;next()}).catch(function(){if(idx===0&&tiles.length>1){tiles=[c];idx=0;results=[];setStatus('Trying OCR fallback…');next()}else{setStatus('OCR failed.',true);done()}})}
      function finish(){var lines=[];results.forEach(function(r){var got=(kind==='table'&&r.data.words)?rowsFromWords(r.data.words):(r.data.text||'').split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean);lines=lines.concat(got)});lines=lines.filter(function(x,i,a){return x&&a.indexOf(x)===i});if(!lines.length){setStatus('No text found. Try a sharper, well-lit photo.',true);done();return}snapshot();lines.forEach(function(l){add(l)});if(lines.some(function(l){return l.indexOf('\t')>=0}))table=lines.map(function(l){return l.split('\t')});setStatus('Found '+lines.length+' lines. Edit, organise or export below.');render();done()}
      function done(){busy=false;$('extractBtn').disabled=!file;bar.hidden=true}next();
    }).catch(function(e){setStatus('Could not read the image: '+(e.message||'unknown error'),true);busy=false;$('extractBtn').disabled=!file;bar.hidden=true});
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
