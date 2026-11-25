// tw-pick.js — поле «сотрудник с поиском» (.pick в tw-theme.css): печатаешь имя или фамилию (слова в любом порядке) — выбираешь из списка.
// Одно на все экраны (выработка: журнал, проверка, подача, приёмка; табель). ES5 — работает и на старых Android.
// Страница описывает свои поля в PICK[ключ]: val — id скрытого поля с выбранным именем; rows() — кого предлагать
// ({name, n — подпись справа, arch — в архиве: виден только когда его нашёл поиск}); done() — что сделать после выбора;
// must — выбор обязателен: строки «Все сотрудники» нет, пустое поле ничего не сбрасывает; allLabel / all() — подпись и хвост строки «все».
// ⚠ ключ даёт id: <ключ>q, <ключ>pick, <ключ>list — проверь, что на странице таких id ещё нет (rwq в выработке был занят).
var PICK=window.PICK||{};
function pkEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
// разметка поля для форм, которые рисуются из кода; подпись — отдельным <label for>, а не обёрткой: клик по строке списка внутри <label> возвращал бы фокус в поле и открывал список снова
function pkHtml(k,ph){ return '<div class="pick" id="'+k+'pick"><input id="'+k+'q" type="search" class="search" placeholder="'+pkEsc(ph)+'" autocomplete="off" oninput="pkDraw(\''+k+'\',1)" onfocus="this.select();pkDraw(\''+k+'\')" onclick="pkDraw(\''+k+'\')" onkeydown="pkKey(\''+k+'\',event)">'
  +'<div class="pick-list" id="'+k+'list" hidden></div></div><input type="hidden" id="'+PICK[k].val+'">'; }
function pkEl(k,x){ return document.getElementById(x==='val'?PICK[k].val:k+x); }
// Пока список закрыт, в поле всегда стоит то, что выбрано на самом деле (иначе в форме подачи поле показывало бы одного, а наряд шёл на другого);
// открыт — человек печатает, не мешаем: при закрытии pkClose вернёт выбранное.
function pkSync(k){ var q=pkEl(k,'q'), v=pkEl(k,'val'), b=pkEl(k,'list'); if(q && v && (!b || b.hidden)) q.value=v.value; }
function pkKeyOf(x){ return String(x||'').toLowerCase().replace(/ё/g,'е'); }
function pkRows(k){
  var ws=pkKeyOf(pkEl(k,'q').value).split(/\s+/).filter(Boolean), cur=pkEl(k,'val').value;
  if(cur && pkKeyOf(cur)===pkKeyOf(pkEl(k,'q').value).trim()) ws=[];   // в поле стоит выбранный — показываем весь список, а не его одного
  var all=PICK[k].rows().filter(function(w){ var n=pkKeyOf(w.name); return ws.every(function(x){ return n.indexOf(x)>=0; }); })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name),'ru'); });
  return { q:ws.length>0, act:all.filter(function(w){ return !w.arch; }), arch:ws.length?all.filter(function(w){ return w.arch; }):[] };
}
function pkDraw(k,typed){
  var box=pkEl(k,'list'), q=pkEl(k,'q'), sel=pkEl(k,'val');
  if(typed && !q.value && sel.value && !PICK[k].must){ pkPick(k,''); return; }   // поле очистили (крестик или стёрли) — снова все сотрудники
  var r=pkRows(k), cur=sel.value;
  var li=function(w){ return '<div class="cb-li'+(w.name===cur?' sel':'')+'" data-n="'+pkEsc(w.name)+'"><span class="cb-lt">'+pkEsc(w.name)+(w.arch?'<i>в архиве</i>':'')+'</span>'+(w.n?'<span class="cb-ln">'+pkEsc(w.n)+'</span>':'')+'</div>'; };
  var h=(r.q||PICK[k].must?'':'<div class="cb-li'+(cur?'':' sel')+'" data-n=""><span class="cb-lt">'+(PICK[k].allLabel||'👥 Все сотрудники')+'</span>'+(PICK[k].all?PICK[k].all():'')+'</div>')
    +r.act.map(li).join('')+r.arch.map(li).join('');
  box.innerHTML=h||'<div class="cb-li0">Никого не нашлось — проверьте написание</div>';
  box.hidden=false;
  if(r.q){ var f=box.querySelector('.cb-li'); if(f){ var s0=box.querySelector('.cb-li.sel'); if(s0) s0.classList.remove('sel'); f.classList.add('sel'); } }
  var on=box.querySelector('.cb-li.sel'); if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest'});
}
function pkPick(k,name){
  var q=pkEl(k,'q'), sel=pkEl(k,'val'), was=sel.value;
  if(!name && PICK[k].must){ pkClose(k); return; }
  sel.value=name; q.value=name; pkEl(k,'list').hidden=true;
  if(name) q.blur();
  if(was!==name) PICK[k].done();
}
function pkClose(k){ var b=pkEl(k,'list'); if(!b||b.hidden) return; b.hidden=true; pkEl(k,'q').value=pkEl(k,'val').value; }
function pkKey(k,e){
  var box=pkEl(k,'list'), key=e.key;
  // Escape в поле type=search браузер сам очищает — без preventDefault поле пустело, а отбор по сотруднику оставался
  // список открыт внутри окна (зарплата) — Escape закрывает список, а не окно под ним
  if(key==='Escape'){ e.preventDefault(); if(!box.hidden) e.stopPropagation(); box.hidden=false; pkClose(k); e.target.blur(); return; }
  if(key==='Tab'){ pkClose(k); return; }
  if(key!=='ArrowDown'&&key!=='ArrowUp'&&key!=='Enter') return;
  e.preventDefault();
  if(box.hidden){ pkDraw(k); return; }
  var its=box.querySelectorAll('.cb-li'), i=-1; if(!its.length) return;
  for(var j=0;j<its.length;j++) if(its[j].classList.contains('sel')) i=j;
  if(key==='Enter'){ if(i>=0) pkPick(k,its[i].getAttribute('data-n')); return; }
  if(i>=0) its[i].classList.remove('sel');
  i=(i+(key==='ArrowDown'?1:-1)+its.length)%its.length; its[i].classList.add('sel'); its[i].scrollIntoView({block:'nearest'});
}
document.addEventListener('click',function(e){
  for(var k in PICK){
    var p=pkEl(k,'pick'); if(!p) continue;
    var it=e.target.closest ? e.target.closest('#'+k+'list .cb-li') : null;
    if(it){ pkPick(k,it.getAttribute('data-n')); return; }
    if(!p.contains(e.target)) pkClose(k);
  }
});
