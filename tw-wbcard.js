/* Карточка нашей накладной (17.11.2026, владелец: «по входящим видим всё, по своим — ничего»).
   Слева — наш документ или скан с бумаги, справа — шапка, строки с НДС и суммами, на что влияет; «✎ Изменить» — правка
   под тем же бланком (документ переформируется, долг и материалы пересчитываются). Сервер: vapi wbcard / wbedit (prohub/src/sales/docs/wbCard.ts).
   twWbCard.open(docId, { get, post, onChange })  — get/post страницы (обещания с JSON); ES5. */
(function(){
var C=null, O={}, EDIT=null, VIEW='doc', BUSY=false;
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function m2(n){ if(window.twMoney) return twMoney(n); n=Number(n)||0; return n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
function q3(n){ n=Math.round((Number(n)||0)*1000)/1000; return String(n).replace('.',','); }
function N(v){ return Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'))||0; }
function $(id){ return document.getElementById(id); }
function origin(){ try{ return new URL((window.TW_CFG&&TW_CFG.hub)||'').origin; }catch(e){ return ''; } }
function css(){
  if($('twwbcss')) return; var s=document.createElement('style'); s.id='twwbcss';
  s.textContent='#twwbc .dlg.wbc{ width:min(1560px,97vw); max-width:none; height:94vh; max-height:94vh; display:grid; grid-template-columns:minmax(300px,42%) minmax(0,1fr); gap:var(--s-4); overflow:hidden; padding:var(--s-4); }'
    +'#twwbc .wbc.one{ grid-template-columns:minmax(0,1fr); width:min(980px,97vw); } #twwbc .wbc.one .wbv{ display:none; }'
    +'#twwbc .wbv{ min-height:0; display:flex; flex-direction:column; gap:var(--s-2); } #twwbc .wbv .seg{ align-self:flex-start; }'
    +'#twwbc .wbv .fr{ flex:1; min-height:0; border:1px solid var(--line); border-radius:var(--r-ctl); overflow:hidden; background:var(--bg2); }'
    +'#twwbc .wbv iframe{ width:100%; height:100%; border:0; display:block; background:var(--bg2); }'
    +'#twwbc .wbb{ min-height:0; overflow:auto; padding-right:var(--s-2); } #twwbc .dlg.wbc{ position:relative; } #twwbc .wbx{ position:absolute; top:var(--s-2); right:var(--s-2); z-index:2; } #twwbc .wbh{ padding-right:var(--s-7); }'
    +'#twwbc .wbh{ display:flex; gap:var(--s-4); justify-content:space-between; align-items:flex-start; flex-wrap:wrap; }'
    +'#twwbc .wbh h3{ margin:0; font:var(--t-title); } #twwbc .wbm{ display:flex; gap:var(--s-2); flex-wrap:wrap; align-items:center; margin-top:var(--s-2); font:var(--t-small); color:var(--muted); }'
    +'#twwbc .wbt{ text-align:right; } #twwbc .wbt .l{ font:var(--t-label); color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }'
    +'#twwbc .wbt .v{ font:var(--t-title); font-variant-numeric:tabular-nums; } #twwbc .wbt .s{ font:var(--t-small); color:var(--muted); font-variant-numeric:tabular-nums; }'
    +'#twwbc .wbp{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:var(--s-2) var(--s-4); margin:var(--s-4) 0; padding:var(--s-3) var(--s-4); border:1px solid var(--line); border-radius:var(--r-ctl); background:var(--bg2); }'
    +'#twwbc .wbp .k{ font:var(--t-label); color:var(--muted); text-transform:uppercase; letter-spacing:.06em; } #twwbc .wbp .pv{ font:var(--t-body); overflow-wrap:anywhere; }'
    +'#twwbc .lbl{ font:var(--t-label); color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin:var(--s-4) 0 var(--s-2); }'
    +'#twwbc table.tbl td.num, #twwbc table.tbl th.num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }'
    +'#twwbc table.tbl tfoot td{ font-weight:600; border-top:1px solid var(--line); }'
    +'#twwbc input.q{ width:6.5em; } #twwbc input.p{ width:7.5em; } #twwbc input.w{ width:100%; min-width:12em; }'
    +'#twwbc .ft{ position:sticky; bottom:0; background:var(--card); padding:var(--s-3) 0 0; margin-top:var(--s-4); border-top:1px solid var(--line); display:flex; gap:var(--s-2); flex-wrap:wrap; align-items:center; }'
    +'#twwbc .ft .sp{ flex:1; }'
    +'@media (max-width:900px){ #twwbc .dlg.wbc{ grid-template-columns:minmax(0,1fr); grid-template-rows:34vh minmax(0,1fr); height:96vh; max-height:96vh; } #twwbc .wbc.one{ grid-template-rows:minmax(0,1fr); } #twwbc .ft{ position:static; } }';
  document.head.appendChild(s);
}
function shell(){
  css(); var b=$('twwbc'); if(b) return b;
  b=document.createElement('div'); b.id='twwbc'; b.className='dlg-bg'; b.style.display='none'; b.style.zIndex='55';
  b.innerHTML='<div class="dlg wbc"><button class="sec ic wbx" onclick="twWbCard.close()" title="закрыть" aria-label="закрыть">✕</button><div class="wbv" id="twwbv"></div><div class="wbb" id="twwbb"></div></div>';
  b.addEventListener('mousedown', function(e){ if(e.target===b) close(); });
  document.body.appendChild(b); return b;
}
function close(){ var b=$('twwbc'); if(b) b.style.display='none'; C=null; EDIT=null; }
function open(id, opts){ O=opts||O; shell().style.display='flex'; EDIT=null; $('twwbb').innerHTML='<div class="muted" style="padding:var(--s-4)">Открываю накладную…</div>'; $('twwbv').innerHTML='';
  O.get({vapi:'wbcard', id:id}).then(function(r){ if(!r||!r.ok){ $('twwbb').innerHTML='<div class="note bad"><div>'+esc((r&&r.error)||'не открылась')+'</div></div>'; return; }
    C=r; VIEW=r.files.docView?'doc':'scan'; draw(); }).catch(function(e){ $('twwbb').innerHTML='<div class="note bad"><div>Связь оборвалась: '+esc((e&&e.message)||e)+'</div></div>'; }); }

function viewer(){
  var f=C.files, has=f.docView||f.scanView, box=$('twwbv'), dlg=box.parentNode;
  dlg.className='dlg wbc'+(has?'':' one'); if(!has){ box.innerHTML=''; return; }
  if(VIEW==='doc'&&!f.docView) VIEW='scan'; if(VIEW==='scan'&&!f.scanView) VIEW='doc';
  var src=origin()+(VIEW==='doc'?f.docView:f.scanView);
  box.innerHTML=(f.docView&&f.scanView?'<div class="seg"><button class="'+(VIEW==='doc'?'on':'')+'" onclick="twWbCard.view(\'doc\')">Наш документ</button><button class="'+(VIEW==='scan'?'on':'')+'" onclick="twWbCard.view(\'scan\')">Скан с бумаги</button></div>'
    : '<div class="sm muted">'+(VIEW==='doc'?'Наш документ':'Скан с бумаги')+'</div>')
    +'<div class="fr"><iframe src="'+esc(src)+'#navpanes=0&view=FitH" title="накладная"></iframe></div>';
}
function head(){
  var st=C.status!=='formed'?'<span class="pill muted">удалена</span>':C.signed?'<span class="pill ok">подписана '+esc(C.signedAt)+'</span>':'<span class="pill warn">ждёт подписи</span>';
  var t=C.totals, cur=esc(C.currency||'BYN');
  return '<div class="wbh"><div><h3>'+esc(C.kind)+' '+esc(C.blank||'без бланка')+'</h3>'
      +'<div class="wbm"><span class="pill info">'+esc(C.purposeRu)+'</span>'+(C.number?'<b>'+esc(C.number)+'</b>':'')+'<span>от <b>'+esc(C.date)+'</b></span>'+st+(C.fromPaper?'<span class="pill muted" title="выписана от руки, загружена сканом">с бумаги</span>':'')+'</div></div>'
      +'<div class="wbt"><div class="l">Всего'+(C.noVat?'':' с НДС')+'</div><div class="v">'+m2(C.rows.length?t.total:C.amount)+' <span class="s">'+cur+'</span></div>'
      +(C.rows.length&&!C.noVat?'<div class="s">без НДС '+m2(t.net)+' · НДС '+m2(t.vat)+'</div>':C.noVat?'<div class="s">без НДС</div>':'')+'</div></div>';
}
function props(){
  var rf=C.refs, links=[];
  if(rf.deal) links.push('<a href="sales.html?deal='+encodeURIComponent(rf.deal.id)+'" target="_blank" rel="noopener">сделка '+esc(rf.deal.num)+'</a>');
  if(rf.incoming) links.push('<a href="docs.html?doc='+encodeURIComponent(rf.incoming.file)+'" target="_blank" rel="noopener">накладная поставщика № '+esc(rf.incoming.docNo)+' от '+esc(rf.incoming.date)+'</a>');
  return '<div class="wbp"><div><div class="k">Получатель</div><div class="pv"><b>'+esc(C.recipient.name)+'</b>'+(C.recipient.unp?' · УНП '+esc(C.recipient.unp):'')+'</div></div>'
    +(C.recipient.address?'<div><div class="k">Адрес</div><div class="pv">'+esc(C.recipient.address)+'</div></div>':'')
    +'<div><div class="k">Основание</div><div class="pv">'+esc(C.basis||'—')+'</div></div>'
    +(links.length?'<div><div class="k">Связано</div><div class="pv">'+links.join(' · ')+'</div></div>':'')+'</div>';
}
function rowsTable(){
  if(!C.rows.length) return '<div class="note info"><div>Строки этой накладной не сохранились (сформирована до 17.11.2026) — смотрите документ слева.</div></div>';
  var t=C.totals;
  return '<div class="lbl">Строки — '+C.rows.length+'</div><div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>№</th><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена без НДС</th><th class="num">Стоимость</th><th class="num">НДС</th><th class="num">Сумма НДС</th><th class="num">Всего</th></tr></thead><tbody>'
    +C.rows.map(function(r,i){ return '<tr><td data-l="№">'+(i+1)+'</td><td data-l="Наименование">'+esc(r.name)+'</td><td data-l="Ед.">'+esc(r.unit)+'</td><td data-l="Кол-во" class="num">'+q3(r.qty)+'</td>'
      +'<td data-l="Цена без НДС" class="num">'+m2(r.price)+'</td><td data-l="Стоимость" class="num">'+m2(r.net)+'</td><td data-l="НДС" class="num">'+esc(r.vatPct)+'</td><td data-l="Сумма НДС" class="num">'+(r.vat?m2(r.vat):'—')+'</td><td data-l="Всего" class="num"><b>'+m2(r.total)+'</b></td></tr>'; }).join('')
    +'</tbody><tfoot><tr><td colspan="5" data-l="">Итого</td><td class="num" data-l="Стоимость">'+m2(t.net)+'</td><td></td><td class="num" data-l="НДС">'+(t.vat?m2(t.vat):'—')+'</td><td class="num" data-l="Всего">'+m2(t.total)+'</td></tr></tfoot></table></div>';
}
function notes(){
  var h='<div class="note info" style="margin-top:var(--s-3)"><div>'+esc(C.money)+'.</div></div>';
  if(C.rows.length&&Math.abs(C.amount-C.totals.total)>0.05) h+='<div class="note warn" style="margin-top:var(--s-2)"><div>В учёте сумма накладной <b>'+m2(C.amount)+'</b>, а по строкам документа <b>'+m2(C.totals.total)+'</b>. Если верны строки — нажмите «Изменить» и сохраните: сумма пересчитается.</div></div>';
  if(C.fromPaper&&C.paperTotal&&Math.abs(C.paperTotal-(C.rows.length?C.totals.total:C.amount))>0.05) h+='<div class="note warn" style="margin-top:var(--s-2)"><div>На бумаге итог <b>'+m2(C.paperTotal)+'</b> — сверьте со сканом.</div></div>';
  return h;
}
function foot(){
  var f=C.files;
  return '<div class="ft">'+(C.editable?'<button onclick="twWbCard.edit()">✎ Изменить</button>':'')
    +(f.doc?'<a class="btn sec" href="'+esc(f.doc)+'" target="_blank" rel="noopener">Документ ↗</a>':'')+(f.scan?'<a class="btn sec" href="'+esc(f.scan)+'" target="_blank" rel="noopener">Скан ↗</a>':'')
    +'<span class="sp"></span><span class="msg" id="twwbm"></span></div>';
}
function draw(){ viewer(); var b=$('twwbb'), top=b.scrollTop; b.innerHTML=head()+props()+notes()+(EDIT?editForm():rowsTable())+(EDIT?editFoot():foot()); b.scrollTop=top; }

/* ── правка ── */
function edit(){ var e=C.edit; if(!e) return; EDIT=JSON.parse(JSON.stringify(e)); EDIT.lines=EDIT.lines||[]; EDIT.extra=EDIT.extra||[]; draw(); }
function inp(path, v, cls, type){ return '<input class="'+(cls||'')+'" '+(type?'type="'+type+'" step="any" min="0" ':'')+'value="'+esc(v==null?'':(type?String(v).replace(',','.'):v))+'" onchange="twWbCard.set(\''+path+'\',this.value)">'; }
function set(path, v){ var p=path.split('.'), o=EDIT; for(var i=0;i<p.length-1;i++) o=o[p[i]]; o[p[p.length-1]]=v; if(/\.doc$|^doc$/.test(path)){ EDIT.lines.forEach(function(l){ l.lineId=''; }); draw(); } }
function del(list, i){ EDIT[list].splice(i,1); draw(); }
function editForm(){
  var e=EDIT, h='<div class="lbl">Изменить накладную — тот же бланк '+esc(C.blank)+'</div>'
    +'<div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-3)"><label><span class="sm">Дата</span>'+inp('date', e.date, 'p')+'</label>'
    +(e.mode!=='sale'?'<label style="flex:1;min-width:16em"><span class="sm">Основание</span>'+inp('basis', e.basis, 'w')+'</label>':'')+'</div>';
  if(e.mode==='sale'){
    h+='<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Строка заказа</th><th class="num">Везём</th><th class="num">Цена с НДС за ед.</th><th></th></tr></thead><tbody>'
      +e.lines.map(function(l,i){ return '<tr><td data-l="Строка">'+esc(l.name)+(l.num?' <span class="sm muted">'+esc(l.num)+'</span>':'')+'</td><td data-l="Везём" class="num">'+inp('lines.'+i+'.qty', l.qty, 'q', 'number')+' <span class="sm muted">из '+q3(l.max)+'</span></td>'
        +'<td data-l="Цена" class="num">'+inp('lines.'+i+'.price', l.price, 'p', 'number')+'</td><td><button class="sec sm" onclick="twWbCard.del(\'lines\','+i+')" title="убрать строку">✕</button></td></tr>'; }).join('')
      +'</tbody></table></div>'
      +((e.open||[]).length?'<div style="margin-top:var(--s-2)"><select onchange="twWbCard.addOpen(this.value);this.value=\'\'"><option value="">＋ добавить строку заказа…</option>'+e.open.map(function(o,i){ return '<option value="'+i+'">'+esc(o.num+' · '+o.name+' (осталось '+q3(o.max)+')')+'</option>'; }).join('')+'</select></div>':'')
      +'<div class="lbl">Сверх заказа</div>'+extraTable();
  } else if(e.mode==='supplier_return'){
    var cur=(e.docs||[]).filter(function(d){ return d.id===e.doc; })[0]||(e.docs||[])[0]||{lines:[]};
    if(!e.doc&&cur.id) e.doc=cur.id;
    h+='<label><span class="sm">Входящая накладная поставщика, по которой возвращаем</span><select onchange="twWbCard.set(\'doc\',this.value)">'+(e.docs||[]).map(function(d){ return '<option value="'+esc(d.id)+'"'+(d.id===e.doc?' selected':'')+'>'+esc('№ '+d.docNo+' от '+d.date+' · '+m2(d.sum))+'</option>'; }).join('')+'</select></label>'
      +'<div class="tbl-wrap" style="margin-top:var(--s-2)"><table class="tbl sm mob"><thead><tr><th>Строка его накладной</th><th class="num">Кол-во</th><th class="num">Цена с НДС за ед.</th><th></th></tr></thead><tbody>'
      +e.lines.map(function(l,i){ return '<tr><td data-l="Строка"><select onchange="twWbCard.set(\'lines.'+i+'.lineId\',this.value)"><option value="">— выберите —</option>'
        +cur.lines.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===l.lineId?' selected':'')+'>'+esc(x.name+' · можно '+q3(x.left)+' '+x.unit+' · '+m2(x.price))+'</option>'; }).join('')+'</select></td>'
        +'<td data-l="Кол-во" class="num">'+inp('lines.'+i+'.qty', l.qty, 'q', 'number')+'</td><td data-l="Цена" class="num">'+inp('lines.'+i+'.price', l.price, 'p', 'number')+'</td><td><button class="sec sm" onclick="twWbCard.del(\'lines\','+i+')">✕</button></td></tr>'; }).join('')
      +'</tbody></table></div><button class="sec sm" style="margin-top:var(--s-2)" onclick="twWbCard.add()">＋ строка</button>'
      +'<div class="sm muted" style="margin-top:var(--s-2)">Цена пустая — возьмётся из накладной поставщика. Долг поставщику и количество материала пересчитаются.</div>';
  } else {
    h+='<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена за ед.</th>'+(e.mode==='return'?'<th>Что это</th>':'')+'<th></th></tr></thead><tbody>'
      +e.lines.map(function(l,i){ var used=l.kind==='used';
        return '<tr><td data-l="Наименование">'+inp('lines.'+i+'.name', l.name, 'w')+'</td><td data-l="Ед.">'+inp('lines.'+i+'.unit', l.unit, 'q')+'</td><td data-l="Кол-во" class="num">'+inp('lines.'+i+'.qty', l.qty, 'q', 'number')+'</td>'
          +'<td data-l="Цена" class="num">'+(used?'<span class="sm muted">не печатается</span>':inp('lines.'+i+'.price', l.price, 'p', 'number'))+'</td>'
          +(e.mode==='return'?'<td data-l="Что это"><select onchange="twWbCard.kind('+i+',this.value)">'+'<option value="p"'+(!used&&l.srcLine==null?' selected':'')+'>продукция</option>'
            +(e.intake||[]).map(function(x){ return '<option value="r'+x.k+'"'+(!used&&l.srcLine===x.k?' selected':'')+'>остаток сырья: '+esc(x.name)+'</option><option value="u'+x.k+'"'+(used&&l.srcLine===x.k?' selected':'')+'>израсходовано: '+esc(x.name)+'</option>'; }).join('')+'</select></td>':'')
          +'<td><button class="sec sm" onclick="twWbCard.del(\'lines\','+i+')">✕</button></td></tr>'; }).join('')
      +'</tbody></table></div><button class="sec sm" style="margin-top:var(--s-2)" onclick="twWbCard.add()">＋ строка</button>';
  }
  return h;
}
function extraTable(){
  return '<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена с НДС за ед.</th><th></th></tr></thead><tbody>'
    +EDIT.extra.map(function(x,i){ return '<tr><td data-l="Наименование">'+inp('extra.'+i+'.name', x.name, 'w')+'</td><td data-l="Ед.">'+inp('extra.'+i+'.unit', x.unit, 'q')+'</td><td data-l="Кол-во" class="num">'+inp('extra.'+i+'.qty', x.qty, 'q', 'number')+'</td><td data-l="Цена" class="num">'+inp('extra.'+i+'.price', x.price, 'p', 'number')+'</td><td><button class="sec sm" onclick="twWbCard.del(\'extra\','+i+')">✕</button></td></tr>'; }).join('')
    +'</tbody></table></div><button class="sec sm" style="margin-top:var(--s-2)" onclick="twWbCard.addX()">＋ строка сверх заказа</button>';
}
function addX(){ EDIT.extra.push({name:'', unit:'шт.', qty:1, price:0}); draw(); }
function add(){ EDIT.lines.push(EDIT.mode==='supplier_return'?{lineId:'', qty:1, price:''}:{kind:'text', name:'', unit:'шт.', qty:1, price:0}); draw(); }
function addOpen(i){ if(i==='') return; var o=EDIT.open.splice(Number(i),1)[0]; if(o){ o.qty=o.max; EDIT.lines.push(o); } draw(); }
function kind(i, v){ var l=EDIT.lines[i]; if(v==='p'){ l.kind='text'; delete l.srcLine; } else { l.kind=v.charAt(0)==='u'?'used':'text'; l.srcLine=Number(v.slice(1)); if(l.kind==='used') l.price=0; } draw(); }
function editFoot(){ return '<div class="ft"><button class="green" id="twwbsave" onclick="twWbCard.save()">Сохранить и переформировать</button><button class="sec" onclick="twWbCard.cancel()">Отмена</button><span class="sp"></span><span class="msg" id="twwbm"></span></div>'; }
function msg(cls, t){ var m=$('twwbm'); if(m){ m.className='msg '+cls; m.innerHTML=t; } }
function save(){
  if(BUSY) return; var e=EDIT, data={date:e.date};
  if(e.mode==='sale'){ data.lines=e.lines.filter(function(l){ return N(l.qty)>0; }).map(function(l){ return {id:l.id, qty:N(l.qty), price:N(l.price)}; });
    data.extra=e.extra.filter(function(x){ return x.name&&N(x.qty)>0; }).map(function(x){ return {sku:x.sku||'', name:x.name, unit:x.unit, qty:N(x.qty), price:N(x.price)}; }); }
  else if(e.mode==='supplier_return'){ data.basis=e.basis; data.doc=e.doc; data.lines=e.lines.filter(function(l){ return N(l.qty)>0; }).map(function(l){ return {lineId:l.lineId, qty:N(l.qty), price:N(l.price)}; });
    if(data.lines.some(function(l){ return !l.lineId; })){ msg('err','У каждой строки выберите строку накладной поставщика'); return; } }
  else { data.basis=e.basis; data.lines=e.lines.filter(function(l){ return l.name&&N(l.qty)>0; }).map(function(l){ var o={kind:l.kind||'text', name:l.name, unit:l.unit, qty:N(l.qty), price:l.kind==='used'?0:N(l.price)};
    if(l.srcLine!=null) o.srcLine=l.srcLine; if(l.refId) o.refId=l.refId; if(l.places) o.places=l.places; if(l.mass) o.mass=l.mass; return o; }); }
  BUSY=true; var b=$('twwbsave'); if(b) b.disabled=true; msg('', 'Переформирую документ… до минуты');
  O.post({vapi:'wbedit', id:C.id, data:JSON.stringify(data)}).then(function(r){ BUSY=false; if(b) b.disabled=false;
    if(!r||!r.ok){ msg('err', '⚠ '+esc((r&&r.error)||'не сохранилось')); return; }
    if(O.onChange) O.onChange(r); open(r.documentId||C.id, O);
  }).catch(function(x){ BUSY=false; if(b) b.disabled=false; msg('err','Связь оборвалась: '+esc((x&&x.message)||x)+' — обновите реестр, прежде чем повторять'); });
}
window.twWbCard={ open:open, close:close, view:function(v){ VIEW=v; viewer(); }, edit:edit, cancel:function(){ EDIT=null; draw(); }, set:set, del:del, add:add, addX:addX, addOpen:addOpen, kind:kind, save:save };
})();
