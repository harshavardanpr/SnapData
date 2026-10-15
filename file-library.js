(function () {
'use strict';
var DB='snapdata-files-v1', STORE='files', TAGS='snapdata.fileTags.v1', promise;
var DEFAULTS=['Worksheets','Exam papers','Important','Resources','Unsorted'];
function openDB() {
  if (promise) return promise;
  promise=new Promise(function(resolve,reject){
    if(!window.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
    var req=indexedDB.open(DB,1);
    req.onupgradeneeded=function(){var d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});};
    req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('Cannot open storage'));};
  });
  return promise;
}
function tx(mode,operation) {
  return openDB().then(function(d){return new Promise(function(resolve,reject){
    var t=d.transaction(STORE,mode),s=t.objectStore(STORE),r=operation(s);
    r.onsuccess=function(){resolve(r.result);};r.onerror=function(){reject(r.error||new Error('Storage operation failed'));};
    t.onabort=function(){reject(t.error||new Error('Storage transaction aborted'));};
  });});
}
function id(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():'f'+Date.now().toString(36)+Math.random().toString(36).slice(2);}
function safeName(s){return String(s||'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,180)||'file';}
function tags(){try{var a=JSON.parse(localStorage.getItem(TAGS)||'null');if(Array.isArray(a)&&a.length)return Array.from(new Set(a.map(function(x){return String(x).trim().slice(0,40)}).filter(Boolean)));}catch(e){}return DEFAULTS.slice();}
function setTags(a){localStorage.setItem(TAGS,JSON.stringify(Array.from(new Set(a.map(function(x){return String(x).trim().slice(0,40)}).filter(Boolean)))));}
function save(name,blob,tag){var rec={id:id(),name:safeName(name),type:blob.type||'application/octet-stream',size:blob.size,tag:tag||'Unsorted',createdAt:new Date().toISOString(),blob:blob};return tx('readwrite',function(s){return s.add(rec)}).then(function(){return rec.id;});}
function all(){return tx('readonly',function(s){return s.getAll()});}
function get(fileId){return tx('readonly',function(s){return s.get(fileId)});}
function update(rec){return tx('readwrite',function(s){return s.put(rec)});}
function download(fileId){return get(fileId).then(function(rec){if(!rec)throw new Error('File missing');var url=URL.createObjectURL(rec.blob),a=document.createElement('a');a.href=url;a.download=rec.name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(function(){URL.revokeObjectURL(url);},1500);});}
function fmtSize(n){if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(2)+' MB';}
function node(tag,attrs,value){var n=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){if(k==='class')n.className=attrs[k];else n.setAttribute(k,attrs[k]);});if(value!==undefined)n.textContent=value;return n;}
function say(s,bad){var n=document.getElementById('libraryStatus');if(n){n.textContent=s;n.className='status'+(bad?' err':'');}}
function fill(select,list,selected,allOption){if(!select)return;select.textContent='';if(allOption)select.appendChild(node('option',{value:'*'},'All tags'));list.forEach(function(t){select.appendChild(node('option',{value:t},t));});if(selected&&(selected==='*'||list.indexOf(selected)>=0))select.value=selected;}
function refreshTags(){var ts=tags(),d=document.getElementById('libraryDefaultTag'),m=document.getElementById('libraryManageTag'),f=document.getElementById('libraryFilterTag');fill(d,ts,d&&d.value,false);fill(m,ts,m&&m.value,false);fill(f,ts,f&&f.value,true);}
function render(){
 var host=document.getElementById('libraryEntries');if(!host)return;
 var filter=document.getElementById('libraryFilterTag').value,query=document.getElementById('librarySearch').value.trim().toLowerCase();
 all().then(function(records){
  host.textContent='';
  records.sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
  records.filter(function(r){return(filter==='*'||r.tag===filter)&&(!query||(r.name+' '+r.tag).toLowerCase().includes(query));}).forEach(function(r){
   var card=node('article',{class:'file-entry'}),main=node('div',{class:'file-entry-main'}),row=node('div',{class:'file-entry-name'}),name=node('input',{type:'text','aria-label':'Filename'});name.value=r.name;
   var rename=node('button',{type:'button',class:'btn sm'},'Rename');
   rename.addEventListener('click',function(){r.name=safeName(name.value);update(r).then(function(){say('Filename updated.');render();}).catch(function(){say('Could not rename file.',true);});});
   row.append(name,rename);main.append(row,node('div',{class:'file-entry-meta'},fmtSize(r.size)+' · '+new Date(r.createdAt).toLocaleDateString()));
   var tag=node('select',{'aria-label':'File tag'});tags().forEach(function(t){tag.appendChild(node('option',{value:t},t));});if(!tags().includes(r.tag))tag.appendChild(node('option',{value:r.tag},r.tag));tag.value=r.tag;
   tag.addEventListener('change',function(){r.tag=tag.value;update(r).then(function(){say('File tag updated.');render();}).catch(function(){say('Could not change tag.',true);});});
   main.appendChild(tag);
   var actions=node('div',{class:'file-entry-actions'}),down=node('button',{type:'button',class:'btn primary sm'},'Download'),del=node('button',{type:'button',class:'btn danger sm'},'Delete');
   down.addEventListener('click',function(){download(r.id).catch(function(){say('Could not download file.',true);});});
   del.addEventListener('click',function(){if(!confirm('Delete this file from the local SnapData library? A previously downloaded copy on your phone will remain.'))return;tx('readwrite',function(s){return s.delete(r.id);}).then(function(){say('File removed from this browser.');render();}).catch(function(){say('Could not delete file.',true);});});
   actions.append(down,del);card.append(main,actions);host.appendChild(card);
  });
  if(!host.children.length)host.appendChild(node('p',{class:'empty'},'No matching files yet. Add a file or save an export from Copy & Export.'));
 }).catch(function(){host.textContent='';host.appendChild(node('p',{class:'empty'},'Local file storage is unavailable in this browser.'));say('Could not open local file storage. Try an updated browser with site storage enabled.',true);});
}
function initTeacherWidget(){
 var upload=document.getElementById('libraryUpload');if(!upload||upload.dataset.ready)return;upload.dataset.ready='1';refreshTags();render();
 upload.addEventListener('change',function(){var selected=Array.from(upload.files||[]),tag=document.getElementById('libraryDefaultTag').value||'Unsorted';if(!selected.length)return;Promise.all(selected.map(function(f){return save(f.name,f,tag);})).then(function(){say('Added '+selected.length+' file(s) to this device.');render();}).catch(function(){say('Could not save all files. Browser storage may be full.',true);}).finally(function(){upload.value='';});});
 document.getElementById('librarySearch').addEventListener('input',render);document.getElementById('libraryFilterTag').addEventListener('change',render);
 document.getElementById('libraryAddTag').addEventListener('click',function(){var field=document.getElementById('libraryNewTag'),name=field.value.trim().slice(0,40),a=tags();if(!name){say('Enter a tag first.',true);return;}if(a.some(function(t){return t.toLowerCase()===name.toLowerCase();})){say('That tag already exists.',true);return;}a.push(name);setTags(a);field.value='';refreshTags();say('Tag added.');render();});
 document.getElementById('libraryRenameTagBtn').addEventListener('click',function(){var old=document.getElementById('libraryManageTag').value,name=document.getElementById('libraryRenameTag').value.trim().slice(0,40),a=tags();if(!name){say('Enter the new tag name.',true);return;}if(a.some(function(t){return t.toLowerCase()===name.toLowerCase()&&t!==old;})){say('That tag already exists.',true);return;}all().then(function(records){return Promise.all(records.filter(function(r){return r.tag===old;}).map(function(r){r.tag=name;return update(r);}));}).then(function(){setTags(a.map(function(t){return t===old?name:t;}));document.getElementById('libraryRenameTag').value='';refreshTags();say('Tag renamed.');render();}).catch(function(){say('Could not rename tag.',true);});});
 document.getElementById('libraryDeleteTagBtn').addEventListener('click',function(){var old=document.getElementById('libraryManageTag').value;if(!old)return;if(!confirm('Delete this tag? Files will be kept and moved to Unsorted.'))return;var a=tags().filter(function(t){return t!==old;});if(!a.includes('Unsorted'))a.push('Unsorted');all().then(function(records){return Promise.all(records.filter(function(r){return r.tag===old;}).map(function(r){r.tag='Unsorted';return update(r);}));}).then(function(){setTags(a);refreshTags();say('Tag deleted; files kept under Unsorted.');render();}).catch(function(){say('Could not delete tag.',true);});});
}
window.SnapDataFileLibrary={save:save,initTeacherWidget:initTeacherWidget,render:render};
})();