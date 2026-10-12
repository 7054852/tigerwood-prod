/* Отгрузка юрлицам РФ и Европы (владелец 11.10.2026): блок «Отгрузка — экспорт» карточки сделки (sales.html) вместо накладных РБ.
   shipprep(deal) → рынок, поля окна, бланк ТН, счёт на оплату, итоги упаковки, документы; packget/packsave — окно «Паллетовка» (паллеты);
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
  h+='<div class="row" style="align-items:center;margin-bottom:var(--s-2)"><span class="sm">🧱 Паллетовка: '+(p.pallets?('<b>'+p.pallets+'</b> паллет · <b>'+p.boxes+'</b> коробок · брутто <b>'+money(p.gross)+'</b> кг'):'<span class="warn">товары не разложены по паллетам</span>')+'</span>'
    +'<button class="sec sm" onclick="twPacking()">🧱 Паллетовка</button></div>';
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
    +chk('shcmr','CMR', !noPack, noPack, noPack?'нужна паллетовка':'')
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

/* ── окно «Паллетовка» (владелец 12.10.2026): слева паллеты — одна из них ВЫБРАНА (подсвечена), справа список «что везём» с остатком;
   товар кладётся на выбранную паллету тем количеством, которое вписано (по умолчанию — весь остаток), так один товар делится на несколько паллет.
   «＋ Паллета» создаёт следующую и сразу делает её выбранной. Коробок по умолчанию = штук (у BusyKids 1 изделие = 1 коробка), правится. ── */
function twPacking(orderKey){
  get({vapi:'packget', deal:TWSH.deal, order:orderKey||''}).then(function(r){
    if(!r||!r.ok){ (typeof oops==='function'?oops:alert)(errText(r)); return; }
    TWPK={ r:r, sel:0, products:null, pallets:(r.pallets||[]).map(function(p){ return { note:p.note||'', lines:(p.lines||[]).map(function(l){ return { productId:l.productId, sku:l.sku, name:l.name, qty:l.qty, boxes:l.boxes, netKg:l.netKg||'', grossKg:l.grossKg||'' }; }) }; }) };
    if(!TWPK.pallets.length) TWPK.pallets.push({ note:'', lines:[] });   // всегда есть паллета, на которую кладём
    var dlg=el('askmodal').querySelector('.dlg'); dlg.classList.add('lg');
    var close=function(){ hide('askmodal'); dlg.classList.remove('lg'); };
    ask('🧱 Паллетовка — сделка '+esc(r.deal.num||''), '<div id="pkbody"></div><div class="msg" id="pkmsg"></div>', function(){
      twPkSync();
      var bad=TWPK.pallets.some(function(p){ return p.lines.some(function(l){ return !(Number(l.qty)>0); }); });
      if(bad){ setm('pkmsg','err','У каждой строки паллеты нужно количество больше 0'); return false; }
      var pallets=TWPK.pallets.filter(function(p){ return p.lines.length; }).map(function(p){ return { note:p.note, lines:p.lines.map(function(l){ return { productId:l.productId, qty:l.qty, boxes:l.boxes, netKg:l.netKg, grossKg:l.grossKg }; }) }; });
      run({vapi:'packsave', deal:TWSH.deal, data:JSON.stringify({ pallets:pallets })}, 'Сохраняю паллетовку…', 'pkmsg').then(function(x){ if(!x) return; close(); twShRefresh(); });
      return false;
    }, 'Сохранить паллетовку');
    el('askNo').onclick=close;
    twPkRender();
  });
}
/** что везём: заказ на производство (по умолчанию — заказ сделки) или позиции сделки; разложено/осталось — по всем паллетам */
function twPkPool(){
  var r=TWPK.r, src=r.order?r.order.items:r.dealItems, placed={};
  TWPK.pallets.forEach(function(p){ p.lines.forEach(function(l){ placed[l.productId]=(placed[l.productId]||0)+(Number(l.qty)||0); }); });
  return (src||[]).map(function(it){ return { productId:it.productId, sku:it.sku, name:it.name, qty:it.qty, placed:placed[it.productId]||0, left:it.qty-(placed[it.productId]||0) }; });
}
function twPkCss(){ if(el('pkcss')) return; var st=document.createElement('style'); st.id='pkcss';
  st.textContent='.pk-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:var(--s-3);align-items:start}@media(max-width:760px){.pk-grid{grid-template-columns:1fr}}'
    +'.pk-pal{border:2px solid var(--line);border-radius:10px;padding:var(--s-2) var(--s-3);margin-top:var(--s-2);cursor:pointer}.pk-pal.on{border-color:var(--accent);background:var(--accent-bg,var(--card2))}'
    +'.pk-pal input{cursor:text}.pk-pal .hd{display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap}.pk-pal .tbl-wrap{max-height:none}.pk-pool{position:sticky;top:0}.pk-pool .tbl-wrap{max-height:48vh}@media(max-width:760px){.pk-pool{position:static}}';
  document.head.appendChild(st); }
function twPkRender(){
  twPkCss();
  var r=TWPK.r, pool=twPkPool(), b=el('pkbody'); if(!b) return;
  if(TWPK.sel>=TWPK.pallets.length) TWPK.sel=TWPK.pallets.length-1; if(TWPK.sel<0) TWPK.sel=0;
  var selNo=TWPK.sel+1, leftAll=pool.reduce(function(s,it){ return s+Math.max(0,it.left); },0);
  // ── паллеты (слева) ──
  var pals=TWPK.pallets.map(function(p,i){
    var net=0, gross=0, boxes=0, qty=0; p.lines.forEach(function(l){ net+=Number(l.netKg)||0; gross+=Number(l.grossKg)||0; boxes+=Number(l.boxes)||0; qty+=Number(l.qty)||0; });
    var on=(i===TWPK.sel);
    var rows=p.lines.map(function(l,j){ return '<tr><td>'+esc(l.name)+' <span class="muted">'+esc(l.sku)+'</span></td>'
      +'<td class="num"><input type="number" min="0" step="1" data-p="'+i+'" data-l="'+j+'" data-k="qty" value="'+esc(l.qty)+'" style="width:64px" onchange="twPkSync();twPkReweigh('+i+','+j+');twPkRender()"></td>'
      +'<td class="num"><input type="number" min="0" step="1" data-p="'+i+'" data-l="'+j+'" data-k="boxes" value="'+esc(l.boxes)+'" style="width:56px"></td>'
      +'<td class="num"><input type="number" min="0" step="0.01" data-p="'+i+'" data-l="'+j+'" data-k="netKg" value="'+esc(l.netKg)+'" style="width:72px"></td>'
      +'<td class="num"><input type="number" min="0" step="0.01" data-p="'+i+'" data-l="'+j+'" data-k="grossKg" value="'+esc(l.grossKg)+'" style="width:72px"></td>'
      +'<td><button class="ic" title="снять с паллеты" onclick="twPkDel('+i+','+j+');event.stopPropagation()">🗑</button></td></tr>'; }).join('');
    return '<div class="pk-pal'+(on?' on':'')+'" onclick="twPkSelect('+i+')" title="'+(on?'выбрана: сюда кладём товар':'нажмите, чтобы класть товар на эту паллету')+'">'
      +'<div class="hd"><b>Паллета '+(i+1)+'</b>'+(on?'<span class="pill ok">выбрана — сюда кладём</span>':'<button class="sm sec" onclick="twPkSelect('+i+');event.stopPropagation()" title="класть товар на эту паллету">выбрать эту</button>')+'<span class="sp"></span>'
      +'<button class="ic" title="выше" onclick="twPkMove('+i+',-1);event.stopPropagation()">↑</button><button class="ic" title="ниже" onclick="twPkMove('+i+',1);event.stopPropagation()">↓</button>'
      +(TWPK.pallets.length>1?'<button class="ic" title="убрать паллету (товар вернётся в «что везём»)" onclick="twPkDelPallet('+i+');event.stopPropagation()">✕</button>':'')+'</div><div class="sm muted">'+qty+' шт · '+boxes+' кор · нетто '+money(net)+' · брутто '+money(gross)+' кг</div>'
      +(rows?'<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Товар</th><th class="num">Шт</th><th class="num">Кор.</th><th class="num">Нетто, кг</th><th class="num">Брутто, кг</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
        :'<div class="sm muted" style="margin-top:var(--s-1)">пусто — '+(on?'выберите товар справа и нажмите «→ Паллета '+(i+1)+'»':'выберите паллету, затем товар справа')+'</div>')
      +'</div>';
  }).join('');
  var left='<div><div class="row" style="align-items:center"><b>Паллеты</b><span class="sm muted">'+TWPK.pallets.length+' шт</span><span class="sp"></span><button class="sec sm" onclick="twPkNew()">＋ Паллета</button></div>'+pals+'</div>';
  // ── что везём (справа) ──
  var ordSel='<select id="pkord" onchange="twPacking(this.value)" style="max-width:100%"><option value="">— позиции сделки —</option>'
    +(r.orders||[]).map(function(o){ return '<option value="'+esc(o.id)+'"'+(r.order&&o.id===r.order.id?' selected':'')+'>'+esc(o.num)+' · '+esc(o.name)+'</option>'; }).join('')+'</select>';
  var prow=pool.map(function(it,i){
    var over=it.left<0, done=it.left===0;
    return '<tr'+(over?' style="color:var(--red)"':done?' class="muted"':'')+'><td>'+esc(it.name)+'<div class="muted sm">'+esc(it.sku)+' · всего '+it.qty+(it.placed?' · разложено '+it.placed:'')+'</div></td>'
      +'<td class="num">'+(over?'<b>лишнее '+(-it.left)+'</b>':done?'✓ всё':('<input type="number" min="1" max="'+it.left+'" step="1" id="pkq'+i+'" value="'+it.left+'" style="width:64px" title="сколько штук положить (остаток '+it.left+')">'))+'</td>'
      +'<td>'+(it.left>0?'<button class="sm" onclick="twPkAdd(\''+esc(it.productId)+'\','+i+')" title="положить указанное количество на выбранную паллету">→ Паллета '+selNo+'</button>':'')+'</td></tr>'; }).join('');
  var right='<div class="pk-pool"><div class="row" style="align-items:center"><b>Что везём</b><span class="sm muted">осталось разложить: <b>'+leftAll+'</b> шт</span></div>'
    +'<div class="sm" style="margin:var(--s-1) 0">Товары из: '+ordSel+'</div>'
    +'<div class="row" style="align-items:center;margin-bottom:var(--s-1)"><b>Кладём на:</b><select id="pktarget" onchange="twPkSelect(Number(this.value))">'+TWPK.pallets.map(function(p,i){ return '<option value="'+i+'"'+(i===TWPK.sel?' selected':'')+'>Паллета '+(i+1)+(p.lines.length?'':' (пустая)')+'</option>'; }).join('')+'</select><span class="sm muted">или нажмите «выбрать эту» у паллеты слева</span></div>'
    +'<div class="sm" style="margin-bottom:var(--s-1)">Впишите, сколько штук, и нажмите <b>→ Паллета '+selNo+'</b>. Остальное — на другую паллету: смените её здесь и нажмите снова. Нетто/брутто считаются по карточке товара (нетто и брутто коробки × штук), правятся в строке.</div>'
    +'<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Товар</th><th class="num">Штук</th><th></th></tr></thead><tbody>'+(prow||'<tr><td colspan="3" class="sm muted">в заказе нет товаров каталога</td></tr>')+'</tbody></table></div>'
    +(leftAll>0?'<div class="row" style="margin-top:var(--s-1)"><button class="gho sm" onclick="twPkAll()">Всё оставшееся — на паллету '+selNo+'</button></div>':'<div class="sm ok" style="margin-top:var(--s-1)">✓ Всё разложено</div>')
    +'<div class="row" style="margin-top:var(--s-3)"><input list="pkcat" id="pkadd" placeholder="другой товар из каталога: артикул или название" style="flex:1" onchange="twPkAddCatalog(this)"><button class="gho sm" onclick="twPkAddCatalog(el(\'pkadd\'))">＋ на паллету '+selNo+'</button></div>'
    +'<datalist id="pkcat"></datalist></div>';
  b.innerHTML='<div class="pk-grid">'+left+right+'</div>';
  if(TWPK.products) twPkFillCat(); else get({vapi:'packproducts'}).then(function(x){ if(x&&x.ok){ TWPK.products=x.products||[]; twPkFillCat(); } });
}
function twPkFillCat(){ var d=el('pkcat'); if(!d) return; d.innerHTML=(TWPK.products||[]).map(function(p){ return '<option value="'+esc(p.sku)+'">'+esc(p.name)+'</option>'; }).join(''); }
function twPkSync(){ var ins=(el('pkbody')||document).querySelectorAll('input[data-p]'); for(var i=0;i<ins.length;i++){ var e=ins[i], p=TWPK.pallets[Number(e.getAttribute('data-p'))]; if(!p) continue; var l=p.lines[Number(e.getAttribute('data-l'))]; if(l) l[e.getAttribute('data-k')]=e.value; } }
function twPkReweigh(i,j){ var l=TWPK.pallets[i]&&TWPK.pallets[i].lines[j]; if(!l) return; if(l.un===undefined){ var u=twPkUnit(l.productId); l.un=u.un; l.ug=u.ug; } twPkWeights(l); }
function twPkSelect(i){ if(i===TWPK.sel) return; twPkSync(); TWPK.sel=i; twPkRender(); }
/** вес строки по карточке товара (нетто/брутто коробки × штук); пусто в карточке — поле остаётся пустым, вписывается руками */
function twPkWeights(l){ var q=Number(l.qty)||0; if(l.un>0) l.netKg=Math.round(l.un*q*100)/100; if(l.ug>0) l.grossKg=Math.round(l.ug*q*100)/100; }
function twPkUnit(productId){ var all=(TWPK.r.order?TWPK.r.order.items:TWPK.r.dealItems)||[]; var it=all.filter(function(x){ return x.productId===productId; })[0]||(TWPK.products||[]).filter(function(x){ return x.productId===productId; })[0]||{}; return { un:Number(it.unitNet)||0, ug:Number(it.unitGross)||0 }; }
function twPkPut(p, it, n){ var ex=p.lines.filter(function(l){ return l.productId===it.productId; })[0], u=twPkUnit(it.productId);
  if(ex){ ex.qty=(Number(ex.qty)||0)+n; ex.boxes=(Number(ex.boxes)||0)+n; ex.un=u.un; ex.ug=u.ug; twPkWeights(ex); } else { var l={ productId:it.productId, sku:it.sku, name:it.name, qty:n, boxes:n, netKg:'', grossKg:'', un:u.un, ug:u.ug }; twPkWeights(l); p.lines.push(l); } }
function twPkAdd(productId, i){ twPkSync(); var it=twPkPool().filter(function(x){ return x.productId===productId; })[0]; if(!it) return;
  var inp=el('pkq'+i), n=Math.round(Number(inp&&inp.value)||0);
  if(!(n>0)){ setm('pkmsg','err','Впишите, сколько штук положить'); return; }
  if(n>it.left){ setm('pkmsg','err','«'+it.name+'»: осталось разложить '+it.left+' шт, а вписано '+n); return; }
  setm('pkmsg','',''); twPkPut(TWPK.pallets[TWPK.sel], it, n); twPkRender(); }
function twPkAll(){ twPkSync(); var left=twPkPool().filter(function(x){ return x.left>0; }); if(!left.length) return; var p=TWPK.pallets[TWPK.sel]; left.forEach(function(it){ twPkPut(p, it, it.left); }); twPkRender(); }
function twPkAddCatalog(inp){ twPkSync(); var v=String((inp&&inp.value)||'').trim(); if(!v) return; var p=(TWPK.products||[]).filter(function(x){ return x.sku.toLowerCase()===v.toLowerCase()||x.name.toLowerCase()===v.toLowerCase(); })[0];
  if(!p){ setm('pkmsg','err','Товар «'+v+'» не найден в каталоге — выберите из списка'); return; } twPkPut(TWPK.pallets[TWPK.sel], p, 1); setm('pkmsg','',''); twPkRender(); }
function twPkDel(i,j){ twPkSync(); TWPK.pallets[i].lines.splice(j,1); twPkRender(); }
function twPkDelPallet(i){ if(TWPK.pallets.length<2) return; twPkSync(); TWPK.pallets.splice(i,1); if(TWPK.sel>=TWPK.pallets.length) TWPK.sel=TWPK.pallets.length-1; twPkRender(); }
function twPkMove(i,d){ twPkSync(); var j=i+d; if(j<0||j>=TWPK.pallets.length) return; var t=TWPK.pallets[i]; TWPK.pallets[i]=TWPK.pallets[j]; TWPK.pallets[j]=t; if(TWPK.sel===i) TWPK.sel=j; else if(TWPK.sel===j) TWPK.sel=i; twPkRender(); }
function twPkNew(){ twPkSync(); TWPK.pallets.push({ note:'', lines:[] }); TWPK.sel=TWPK.pallets.length-1; twPkRender(); }
