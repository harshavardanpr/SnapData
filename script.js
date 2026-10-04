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

  function buildTable(){if(!table.length)table=items.map(function(i){return i.text.split(/\t|\||\s{2,}/)});var cols=0;table.forEach(function(r){cols=Math.max(cols,r.length)});table.forEach(function(r){while(r.length<cols)r.push('')})}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function syncItemsFromTable(){items=table.map(function(r,i){return{id:++uid,text:r.join('\t'),sel:false,o:i}})}
  function selectedTableCells(){var out=[];$('tableWrap').querySelectorAll('.cell-check[data-r]:checked').forEach(function(i){out.push({r:+i.dataset.r,c:+i.dataset.c})});return out}
  function renderTable(){buildTable();var w=$('tableWrap');if(!table.length){w.innerHTML='<p class="empty">No table yet. Extract a table first.</p>';return}var h='<div class="table-tools"><button id="tableSelectAll" class="btn sm">Select all cells</button><button id="tableClearSel" class="btn sm">Clear selection</button><button id="addRow" class="btn sm">Add row</button><button id="addCol" class="btn sm">Add column</button></div><table class="data-table"><thead><tr><th>#</th>';for(var c=0;c<table[0].length;c++)h+='<th><input class="cell-check col-check" type="checkbox" data-col="'+c+'" aria-label="Select column"></th>';h+='</tr></thead><tbody>';for(var r=0;r<table.length;r++){h+='<tr><th><input class="cell-check row-check" type="checkbox" data-row="'+r+'" aria-label="Select row"></th>';for(var j=0;j<table[r].length;j++)h+='<td><input class="cell-check" type="checkbox" data-r="'+r+'" data-c="'+j+'"><input class="cell-input" value="'+esc(table[r][j])+'" data-er="'+r+'" data-ec="'+j+'"></td>';h+='</tr>'}h+='</tbody></table>';w.innerHTML=h;
    w.querySelectorAll('[data-er]').forEach(function(i){i.oninput=function(){table[+i.dataset.er][+i.dataset.ec]=i.value;syncItemsFromTable()}});
    w.querySelectorAll('.cell-check:not(.row-check):not(.col-check)').forEach(function(i){i.onchange=function(){i.closest('td').classList.toggle('selected',i.checked)}});
    w.querySelectorAll('.row-check').forEach(function(i){i.onchange=function(){w.querySelectorAll('[data-r="'+i.dataset.row+'"]').forEach(function(c){c.checked=i.checked;c.closest('td').classList.toggle('selected',i.checked)})}});
    w.querySelectorAll('.col-check').forEach(function(i){i.onchange=function(){w.querySelectorAll('[data-c="'+i.dataset.col+'"]').forEach(function(c){c.checked=i.checked;c.closest('td').classList.toggle('selected',i.checked)})}});
    $('tableSelectAll').onclick=function(){w.querySelectorAll('.cell-check').forEach(function(i){i.checked=true;if(i.closest('td'))i.closest('td').classList.add('selected')})};
    $('tableClearSel').onclick=function(){w.querySelectorAll('.cell-check').forEach(function(i){i.checked=false;if(i.closest('td'))i.closest('td').classList.remove('selected')})};
    $('addRow').onclick=function(){snapshot();table.push(table[0].map(function(){return ''}));syncItemsFromTable();renderTable()};
    $('addCol').onclick=function(){snapshot();table.forEach(function(r){r.push('')});syncItemsFromTable();renderTable()};
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
    items = out; table = items.map(function(i){return i.text.split(/\t|\||\s{2,}/)}); render(); toast('Split into cells');
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
    if(mode==='table'){var cells=selectedTableCells();if(!cells.length){toast('Select table cells first');return}if(isNaN(v)){toast('Enter a value first');return}if(op==='/'&&v===0){toast('Cannot divide by zero');return}snapshot();cells.forEach(function(p){if(isNum(table[p.r][p.c])){var n=toNum(table[p.r][p.c]);table[p.r][p.c]=fmt(op==='+'?n+v:op==='-'?n-v:op==='*'?n*v:n/v)}});syncItemsFromTable();renderTable();return}
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
    if(kind==='xlsx'){if(typeof XLSX==='undefined'){toast('XLSX library not loaded');return}buildTable();var ws=XLSX.utils.aoa_to_sheet(table);var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'SnapData');XLSX.writeFile(wb,'snapdata.xlsx');toast('Exported XLSX');return}
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
  $('saveEnhanced').onclick=saveEnhanced;$('resetEdit').onclick=resetEdit;$('rotL').onclick=function(){edit.rotation-=90;drawPreview()};$('rotR').onclick=function(){edit.rotation+=90;drawPreview()};
  ['zoom','brightness','contrast','sharpen'].forEach(function(id){$(id).oninput=function(){edit[id]=id==='zoom'?+this.value/100:+this.value;drawPreview()}});
  $('crop').onclick=function(){if(!cropStart){toast('Drag on the image first');return}applyCrop()};
  $('preview').onpointerdown=function(e){var r=this.getBoundingClientRect();cropStart={x:e.clientX-r.left,y:e.clientY-r.top,ex:e.clientX-r.left,ey:e.clientY-r.top};this.setPointerCapture(e.pointerId)};
  $('preview').onpointermove=function(e){if(cropStart){var r=this.getBoundingClientRect();cropStart.ex=e.clientX-r.left;cropStart.ey=e.clientY-r.top}};
  $('preview').onpointerup=function(){if(cropStart)toast('Crop area selected — tap Crop')};
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
  $('expXlsx').onclick=function(){exportData('xlsx')};
  $('share').onclick=function(){var text=items.map(function(i){return i.text}).join('\n');if(navigator.share)navigator.share({title:'SnapData result',text:text}).catch(function(){});else copy(false)};
  $('listTab').onclick=function(){mode='list';$('listTab').classList.add('active');$('tableTab').classList.remove('active');$('list').hidden=false;$('tableWrap').hidden=true;$('itemActions').hidden=false};
  $('tableTab').onclick=function(){mode='table';buildTable();$('tableTab').classList.add('active');$('listTab').classList.remove('active');$('list').hidden=true;$('tableWrap').hidden=false;$('itemActions').hidden=true;renderTable()};
  render();
})();
