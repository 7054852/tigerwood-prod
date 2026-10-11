/* Отгрузка юрлицам РФ и Европы (владелец 11.10.2026): блок «Отгрузка — экспорт» карточки сделки (sales.html) вместо накладных РБ.
   shipprep(deal) → рынок, поля окна, бланк ТН, счёт на оплату, итоги упаковки, документы; packget/packsave — окно «Упаковка» (паллеты);
   shipissue(deal, data) — комплект: счёт-фактура РФ / коммерческий инвойс → упаковочный лист → CMR → ТН; declupload — декларация от декларанта.
   Ждёт от страницы: get, run, ask, hide, el, val, esc, setm, money, ruDate, isoDate, errText, twFileCard. */
var TWSH=null, TWPK=null;
function twShippingBlock(dealKey, box){
  if(typeof box==='string') box=el(box); if(!box) return;
  TWSH={ deal:dealKey, box:box };
  box.innerHTML='<div class="sm">Загружаю отгрузку…</div>';
  get({vapi:'shipprep', deal:dealKey}).then(function(r){
    if(!r||!r.ok){ box.innerHTML='<div class="sm err">Отгрузка не загрузилась: '+esc(errText(r))+'</div>'; return; }
    TWSH.r=r; twShRender();
  }).catch(function(e){ box.innerHTML='<div class="sm err">Связь оборвалась: '+esc((e&&e.message)||e)+'</div>'; });
}
function twShRefresh(){ twShippingBlock(TWSH.deal, TWSH.box); }
function twShRender(){
  var r=TWSH.r, p=r.packing||{}, h='';
  h+='<div class="sm" style="margin-bottom:var(--s-2)">Рынок <b>'+esc(r.eu?'Европа':'Россия')+'</b> · счёт на оплату '+(r.payInvoice?'<b>№ '+esc(r.payInvoice)+'</b>':'<span class="warn">не выставлен</span>')
    +' · заказ на производство '+(r.order?'<b>'+esc(r.order.num)+'</b>':'<span class="warn">не заведён</span>')+'</div>';
  h+='<div class="row" style="align-items:center;margin-bottom:var(--s-2)"><span class="sm">📦 Упаковка: '+(p.pallets?('<b>'+p.pallets+'</b> паллет · <b>'+p.boxes+'</b> коробок · брутто <b>'+money(p.gross)+'</b> кг'):'<span class="warn">товары не разложены по паллетам</span>')+'</span>'
    +'<button class="sec sm" onclick="twPacking()">📦 Упаковка</button></div>';
  h+=(r.docs||[]).map(function(d){
    var pills=d.uploaded?'<span class="pill info">загружен</span>':(d.status==='сформирован'?'<span class="pill ok">'+esc(d.status)+'</span>':'<span class="pill bad">'+esc(d.status)+'</span>');
    var acts=d.docType==='waybill_tn'&&!d.uploaded?'<a href="#" onclick="twWbPdf(\''+esc(d.id)+'\');return false;" title="одна страница A4, без сетки — для печати на бланке">🖨 PDF для печати</a>':'';
    return twFileCard({ href:d.url, tab:1, tag:twShTag(d.docType), title:d.type+(d.number&&d.number!=='декларация'?' '+d.number:''), meta:[d.date, d.name].filter(Boolean).join(' · '), pills:pills, acts:acts, off:d.status!=='сформирован' });
  }).join('');
  if(!(r.docs||[]).length) h+='<div class="sm">Отгрузочных документов ещё нет.</div>';
  h+='<div class="row" style="margin-top:var(--s-2);align-items:center"><button class="sec sm" onclick="twShipDlg()">✍️ Выписать отгрузочные документы</button>'
    +'<button class="gho sm" onclick="twDeclDlg()">⬆ Декларация от декларанта</button></div><div class="msg" id="twshmsg"></div>';
  TWSH.box.innerHTML=h;
}
function twShTag(t){ return {invoice_rf_vat:'СФ', commercial_invoice:'CI', packing_list:'УПАК', cmr:'CMR', waybill_tn:'ТН', customs_declaration:'ДЕКЛ'}[t]||'ФАЙЛ'; }

/* ── окно «Выписать отгрузочные документы» ── */
function twShipDlg(){
  var r=TWSH.r, f=r.fields||{}, L='display:block;margin-top:var(--s-2)', SM='display:block;font:var(--t-small);color:var(--muted);margin-bottom:var(--s-1)';
  var inp=function(id,label,v,ph,type){ return '<label style="'+L+'"><span style="'+SM+'">'+label+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(v||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off" style="width:100%"></label>'; };
  var chk=function(id,label,on,dis,note){ return '<label class="sm" style="display:block;margin-top:var(--s-2)"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+(dis?' disabled':'')+'> '+label+(note?' <span class="muted">— '+esc(note)+'</span>':'')+'</label>'; };
  var noPack=!(r.packing&&r.packing.pallets), bl=r.blank||{}, opts=[], seen={};
  if(bl.reserved){ opts.push('<option value="'+esc(bl.reserved.id)+'" selected>'+esc(bl.reserved.label)+' — зарезервирован за сделкой</option>'); seen[bl.reserved.id]=1; }
  (bl.free||[]).forEach(function(b,i){ if(seen[b.id]) return; opts.push('<option value="'+esc(b.id)+'"'+(!bl.reserved&&i===0?' selected':'')+'>'+esc(b.label)+(i===0?' — следующий свободный':'')+'</option>'); });
  var body='<div class="sm" style="margin-bottom:var(--s-2)">Клиент: <b>'+esc(r.deal.client)+'</b>'+(r.payInvoice?' · счёт на оплату № '+esc(r.payInvoice):'')+'</div>'
    +(r.payInvoice?'':'<div class="note warn"><div>⚠ Счёт на оплату не выставлен — '+esc(r.invoiceTitle)+' выставляется по нему.</div></div>')
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 var(--s-3)">'
    +inp('shd','📅 Дата погрузки (= дата ТН и CMR)',isoDate(f.loadDate),'', 'date')+inp('shup','Место разгрузки (CMR п. 3)',f.unloadPlace,'Osík')+inp('shuc','Страна разгрузки',f.unloadCountry,'Česká republika')
    +inp('shtr','Тягач (CMR п. 25)',f.tractor,'DAF AC 3958-5')+inp('shtl','Полуприцеп (CMR п. 26)',f.trailer,'WIELTON H03102')+'</div>'
    +inp('shin','Указания отправителя — таможенный склад (CMR п. 13)',f.instructions,'Nam. 17. listopadu 2059, 560 02 Ceska Trebova, CZ')
    +'<div class="sm" style="margin-top:var(--s-3);font-weight:600">Что выписать</div>'
    +chk('shinv', esc(r.invoiceTitle)+(r.shipInvoice?' — переформировать № '+esc(r.shipInvoice.number):' — новый номер'), true, !r.payInvoice)
    +chk('shpk','Упаковочный лист', !noPack, noPack, noPack?'сначала разложите товары по паллетам':'')
    +chk('shcmr','CMR', !noPack, noPack, noPack?'нужна упаковка':'')
    +chk('shtn','ТН на бланке', true, !opts.length, !opts.length?'нет свободных бланков ТН':'')
    +(opts.length?'<label style="'+L+'"><span style="'+SM+'">🧾 Бланк ТН (номер на бумаге)</span><select id="shbl" style="width:100%">'+opts.join('')+'</select></label>':'')
    +'<div class="sm muted" style="margin-top:var(--s-2)">Порядок: '+esc(r.invoiceTitle)+' → упаковочный лист → CMR (номер ММ/ГГГГ, второй в месяце — /2) → ТН с номером CMR. Повтор переформирует документ под тем же номером.</div>'
    +'<div class="msg" id="shmsg"></div><div id="shout"></div>';
  ask('🚚 Отгрузочные документы — '+esc(r.eu?'Европа':'Россия'), body, function(){
    var docs=[]; ['shinv|invoice','shpk|packing','shcmr|cmr','shtn|tn'].forEach(function(x){ var p=x.split('|'), e=el(p[0]); if(e&&e.checked&&!e.disabled) docs.push(p[1]); });
    if(!docs.length){ setm('shmsg','err','Отметьте хотя бы один документ'); return false; }
    var data={ fields:{ loadDate:ruDate(val('shd')), unloadPlace:val('shup').trim(), unloadCountry:val('shuc').trim(), instructions:val('shin').trim(), tractor:val('shtr').trim(), trailer:val('shtl').trim() }, docs:docs, blankId:val('shbl') };
    run({vapi:'shipissue', deal:TWSH.deal, data:JSON.stringify(data)}, 'Выписываю документы…', 'shmsg').then(function(x){ if(!x) return;
      var res=x.results||{}, names={invoice:TWSH.r.invoiceTitle, packing:'Упаковочный лист', cmr:'CMR', tn:'ТН'}, h='';
      Object.keys(res).forEach(function(k){ var v=res[k]||{}; h+='<div>'+(v.ok?'✅':'❌')+' '+esc(names[k]||k)+(v.number?' № '+esc(v.number):'')+(v.blank?' '+esc(v.blank):'')+': '+(v.ok?(v.url?'<a href="'+esc(v.url)+'" target="_blank" rel="noopener">открыть</a>':'готово'):'<span class="err">'+esc(v.error||errText(v))+'</span>')+(v.ok&&v.error?' <span class="err">'+esc(v.error)+'</span>':'')+'</div>'; });
      el('shout').innerHTML=h; setm('shmsg','ok','Готово — окно можно закрыть'); el('askNo').textContent='Закрыть'; twShRefresh();
    });
    return false;
  }, 'Выписать');
}

/* ── декларация ── */
function twDeclDlg(){
  var body='<div class="sm">Файл декларации от декларанта (PDF или фото) сохраняется в сделку.</div>'
    +'<label style="display:block;margin-top:var(--s-2)"><span class="sm">Файл</span><input type="file" id="dclf" accept="application/pdf,image/*"></label>'
    +'<label style="display:block;margin-top:var(--s-2)"><span class="sm">Дата декларации</span><input type="date" id="dcld" value="'+esc(todayIso())+'"></label><div class="msg" id="dclm"></div>';
  ask('⬆ Декларация', body, function(){
    var f=(el('dclf').files||[])[0]; if(!f){ setm('dclm','err','Выберите файл'); return false; }
    var rd=new FileReader();
    rd.onload=function(){ var b64=String(rd.result).split(',')[1]||'';
      run({vapi:'declupload', deal:TWSH.deal, b64:b64, name:f.name||'', mime:f.type||'', date:ruDate(val('dcld'))}, 'Загружаю декларацию…', 'dclm').then(function(x){ if(!x) return; hide('askmodal'); twShRefresh(); }); };
    rd.readAsDataURL(f); return false;
  }, 'Загрузить');
}

/* ── окно «Упаковка»: паллеты и товары на них ── */
function twPacking(orderKey){
  get({vapi:'packget', deal:TWSH.deal, order:orderKey||''}).then(function(r){
    if(!r||!r.ok){ (typeof oops==='function'?oops:alert)(errText(r)); return; }
    TWPK={ r:r, pallets:(r.pallets||[]).map(function(p){ return { note:p.note||'', lines:(p.lines||[]).map(function(l){ return { productId:l.productId, sku:l.sku, name:l.name, qty:l.qty, boxes:l.boxes, netKg:l.netKg||'', grossKg:l.grossKg||'' }; }) }; }), products:null };
    ask('📦 Упаковка — сделка '+esc(r.deal.num||''), '<div id="pkbody"></div><div class="msg" id="pkmsg"></div>', function(){
      twPkSync();
      var bad=TWPK.pallets.some(function(p){ return p.lines.some(function(l){ return !(Number(l.qty)>0); }); });
      if(bad){ setm('pkmsg','err','У каждой строки паллеты нужно количество'); return false; }
      run({vapi:'packsave', deal:TWSH.deal, data:JSON.stringify({ pallets:TWPK.pallets })}, 'Сохраняю упаковку…', 'pkmsg').then(function(x){ if(!x) return; hide('askmodal'); twShRefresh(); });
      return false;
    }, 'Сохранить упаковку');
    twPkRender();
  });
}
/** источник товаров: заказ (по умолчанию — заказ сделки) или позиции сделки */
function twPkPool(){
  var r=TWPK.r, src=r.order?r.order.items:r.dealItems, placed={};
  TWPK.pallets.forEach(function(p){ p.lines.forEach(function(l){ placed[l.productId]=(placed[l.productId]||0)+(Number(l.qty)||0); }); });
  return (src||[]).map(function(it){ return { productId:it.productId, sku:it.sku, name:it.name, qty:it.qty, placed:placed[it.productId]||0, left:it.qty-(placed[it.productId]||0) }; });
}
function twPkRender(){
  var r=TWPK.r, pool=twPkPool(), b=el('pkbody'); if(!b) return;
  var ordSel='<select id="pkord" onchange="twPacking(this.value)" style="max-width:100%"><option value="">— позиции сделки —</option>'
    +(r.orders||[]).map(function(o){ return '<option value="'+esc(o.id)+'"'+(r.order&&o.id===r.order.id?' selected':'')+'>'+esc(o.num)+' · '+esc(o.name)+'</option>'; }).join('')+'</select>';
  var h='<div class="sm">Товары из: '+ordSel+'</div>';
  h+='<div class="tbl-wrap" style="margin-top:var(--s-2)"><table class="tbl sm"><thead><tr><th>Товар</th><th class="num">В заказе</th><th class="num">Разложено</th><th class="num">Осталось</th><th></th></tr></thead><tbody>'
    +pool.map(function(it,i){ return '<tr'+(it.left<0?' style="color:var(--red)"':'')+'><td>'+esc(it.name)+' <span class="muted">'+esc(it.sku)+'</span></td><td class="num">'+it.qty+'</td><td class="num">'+it.placed+'</td><td class="num"><b>'+it.left+'</b></td>'
      +'<td>'+(it.left>0?'<button class="gho sm" onclick="twPkAdd(\''+esc(it.productId)+'\')" title="на последнюю паллету">＋ на паллету</button>':'')+'</td></tr>'; }).join('')
    +'</tbody></table></div>';
  if(pool.some(function(it){ return it.left>0; })) h+='<div class="row" style="margin-top:var(--s-1)"><button class="gho sm" onclick="twPkAll()">Всё оставшееся — на новую паллету</button></div>';
  h+=TWPK.pallets.map(function(p,i){
    var net=0, gross=0, boxes=0; p.lines.forEach(function(l){ net+=Number(l.netKg)||0; gross+=Number(l.grossKg)||0; boxes+=Number(l.boxes)||0; });
    var rows=p.lines.map(function(l,j){ return '<tr><td>'+esc(l.name)+' <span class="muted">'+esc(l.sku)+'</span></td>'
      +'<td class="num"><input type="number" min="0" step="1" data-p="'+i+'" data-l="'+j+'" data-k="qty" value="'+esc(l.qty)+'" style="width:64px"></td>'
      +'<td class="num"><input type="number" min="0" step="1" data-p="'+i+'" data-l="'+j+'" data-k="boxes" value="'+esc(l.boxes)+'" style="width:56px"></td>'
      +'<td class="num"><input type="number" min="0" step="0.01" data-p="'+i+'" data-l="'+j+'" data-k="netKg" value="'+esc(l.netKg)+'" style="width:72px"></td>'
      +'<td class="num"><input type="number" min="0" step="0.01" data-p="'+i+'" data-l="'+j+'" data-k="grossKg" value="'+esc(l.grossKg)+'" style="width:72px"></td>'
      +'<td><button class="ic" title="убрать" onclick="twPkDel('+i+','+j+')">🗑</button></td></tr>'; }).join('');
    return '<div class="box" style="margin-top:var(--s-3)"><div class="row" style="align-items:center"><b>Паллета '+(i+1)+'</b><span class="sm muted">'+boxes+' кор · нетто '+money(net)+' · брутто '+money(gross)+' кг</span>'
      +'<span class="sp"></span><button class="ic" title="выше" onclick="twPkMove('+i+',-1)">↑</button><button class="ic" title="ниже" onclick="twPkMove('+i+',1)">↓</button><button class="ic" title="убрать паллету" onclick="twPkDelPallet('+i+')">✕</button></div>'
      +'<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Товар</th><th class="num">Шт</th><th class="num">Кор.</th><th class="num">Нетто</th><th class="num">Брутто</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="sm muted">пусто</td></tr>')+'</tbody></table></div>'
      +'<div class="row" style="margin-top:var(--s-1)"><input list="pkcat" id="pkadd'+i+'" placeholder="товар из каталога: артикул или название" style="flex:1" onchange="twPkAddCatalog('+i+',this)"><button class="gho sm" onclick="twPkAddCatalog('+i+',el(\'pkadd'+i+'\'))">＋ товар</button></div></div>';
  }).join('');
  h+='<div class="row" style="margin-top:var(--s-3)"><button class="sec sm" onclick="twPkNew()">＋ Паллета</button></div><datalist id="pkcat"></datalist>';
  b.innerHTML=h;
  if(TWPK.products) twPkFillCat(); else get({vapi:'packproducts'}).then(function(x){ if(x&&x.ok){ TWPK.products=x.products||[]; twPkFillCat(); } });
}
function twPkFillCat(){ var d=el('pkcat'); if(!d) return; d.innerHTML=(TWPK.products||[]).map(function(p){ return '<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>'; }).join(''); }
function twPkSync(){ var ins=(el('pkbody')||document).querySelectorAll('input[data-p]'); for(var i=0;i<ins.length;i++){ var e=ins[i], p=TWPK.pallets[Number(e.getAttribute('data-p'))]; if(!p) continue; var l=p.lines[Number(e.getAttribute('data-l'))]; if(l) l[e.getAttribute('data-k')]=e.value; } }
function twPkLast(){ if(!TWPK.pallets.length) TWPK.pallets.push({ note:'', lines:[] }); return TWPK.pallets[TWPK.pallets.length-1]; }
function twPkAdd(productId){ twPkSync(); var it=twPkPool().filter(function(x){ return x.productId===productId; })[0]; if(!it) return; var p=twPkLast();
  var ex=p.lines.filter(function(l){ return l.productId===productId; })[0]; if(ex) ex.qty=(Number(ex.qty)||0)+it.left; else p.lines.push({ productId:it.productId, sku:it.sku, name:it.name, qty:it.left, boxes:0, netKg:'', grossKg:'' }); twPkRender(); }
function twPkAll(){ twPkSync(); var left=twPkPool().filter(function(x){ return x.left>0; }); if(!left.length) return; TWPK.pallets.push({ note:'', lines:left.map(function(it){ return { productId:it.productId, sku:it.sku, name:it.name, qty:it.left, boxes:0, netKg:'', grossKg:'' }; }) }); twPkRender(); }
function twPkAddCatalog(i, inp){ twPkSync(); var v=String((inp&&inp.value)||'').trim(); if(!v) return; var p=(TWPK.products||[]).filter(function(x){ return x.sku.toLowerCase()===v.toLowerCase()||x.name.toLowerCase()===v.toLowerCase(); })[0];
  if(!p){ setm('pkmsg','err','Товар «'+v+'» не найден в каталоге — выберите из списка'); return; } TWPK.pallets[i].lines.push({ productId:p.productId, sku:p.sku, name:p.name, qty:1, boxes:0, netKg:'', grossKg:'' }); setm('pkmsg','',''); twPkRender(); }
function twPkDel(i,j){ twPkSync(); TWPK.pallets[i].lines.splice(j,1); twPkRender(); }
function twPkDelPallet(i){ twPkSync(); TWPK.pallets.splice(i,1); twPkRender(); }
function twPkMove(i,d){ twPkSync(); var j=i+d; if(j<0||j>=TWPK.pallets.length) return; var t=TWPK.pallets[i]; TWPK.pallets[i]=TWPK.pallets[j]; TWPK.pallets[j]=t; twPkRender(); }
function twPkNew(){ twPkSync(); TWPK.pallets.push({ note:'', lines:[] }); twPkRender(); }
