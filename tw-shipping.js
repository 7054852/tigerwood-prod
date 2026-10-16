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
    +'<button class="sec sm" onclick="twPacking()">🧱 Паллетовка</button>'+(p.pallets?'<button class="gho sm" onclick="twPalletSheets()" title="лист на каждую паллету: что на ней лежит — печать на A4">🏷 Листы на паллеты</button>':'')
    +'<button class="gho sm" onclick="twBoxStickers()" title="стикер 40×30 мм на коробку для каждого товара заказа — печать на принтере наклеек">🔖 Стикеры на коробки</button></div>';
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
  // частичная отгрузка (владелец 16.10.2026): документы — на то, что на паллетах; уже уехавшее по прошлым ТН; вторая отгрузка — «ещё одна» (новые ТН/CMR/инвойс)
  var lines=r.lines||[], prevTn=r.prevTn||[], partial=Array.isArray(r.lines);
  var canRedo=prevTn.length===1&&!prevTn[0].signed, anyLeft=lines.some(function(l){ return l.qty-l.shipped>0; });
  TWSH.newBlank=partial&&prevTn.length>0&&(!canRedo||anyLeft);
  var ltab=partial&&lines.length?'<div id="shlines"></div>':'';
  var mode='';
  if(partial&&canRedo) mode='<div class="note" style="margin-top:var(--s-2)"><div>По сделке уже есть ТН <b>'+esc(prevTn[0].blank)+'</b> от '+esc(prevTn[0].date)+' на '+esc(prevTn[0].sum)+'.'
    +'<label style="display:block;margin-top:var(--s-1)"><input type="radio" name="shmode" value="new"'+(TWSH.newBlank?' checked':'')+' onchange="twShMode(true)"> ➕ Ещё одна отгрузка — новые ТН, CMR и инвойс (прежние остаются)</label>'
    +'<label style="display:block"><input type="radio" name="shmode" value="redo"'+(TWSH.newBlank?'':' checked')+' onchange="twShMode(false)"> ♻️ Переформировать прежние (ТН на том же бланке, CMR с тем же номером)</label></div></div>';
  else if(partial&&prevTn.length) mode='<div class="note" style="margin-top:var(--s-2)"><div>По сделке уже '+prevTn.length+' ТН'+(prevTn.length===1?' (подписана)':'')+' — эта отгрузка будет ещё одной: новые ТН, CMR и инвойс.</div></div>';
  var body='<div class="sm" style="margin-bottom:var(--s-2)">Клиент: <b>'+esc(r.deal.client)+'</b>'+(r.payInvoice?' · счёт на оплату № '+esc(r.payInvoice):'')+'</div>'+ltab+mode
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
  var noPack0=noPack;
  // таблица «что отгружаем»: переформирование — переформируемая ТН из «уже уехало» вычитается (её количество снова свободно)
  TWSH.renderLines=function(){ var box=el('shlines'); if(!box) return; var nb=TWSH.newBlank, prev=prevTn[0], ps={}; if(prev&&!nb) (prev.ship||[]).forEach(function(l){ ps[l.id]=Number(l.qty)||0; });
    var over=0, under=0, h='<div class="tbl-wrap" style="margin-top:var(--s-2)"><table class="tbl sm mob"><thead><tr><th>Товар</th><th class="num">Заказано</th><th class="num">Уже уехало</th><th class="num">На паллетах — отгружаем</th></tr></thead><tbody>'
      +lines.map(function(l){ var sh=nb?l.shipped:(prev?(prev.ship?Math.max(0,l.shipped-(ps[l.id]||0)):Math.max(0,l.shipped-l.qty)):l.shipped), left=Math.max(0,l.qty-sh); if(l.onPallets>left) over++; if(l.onPallets<left) under++;
        return '<tr><td data-l="Товар">'+esc(l.name)+'</td><td data-l="Заказано" class="num">'+esc(l.qty)+'</td><td data-l="Уже уехало" class="num">'+esc(sh)+'</td><td data-l="На паллетах" class="num"><b'+(l.onPallets>left?' class="err"':'')+'>'+esc(l.onPallets)+'</b></td></tr>'; }).join('')
      +'</tbody></table></div>'
      +(noPack0?'<div class="sm muted">Паллетовки нет — документы будут на все позиции сделки.</div>':'')
      +(over?'<div class="note warn"><div>⚠ На паллетах больше, чем осталось по сделке — проверьте паллетовку.</div></div>':'')
      +(under&&!noPack0?'<div class="sm muted">Частичная отгрузка: остаток уйдёт следующей отгрузкой (ещё одна ТН и CMR).</div>':'');
    box.innerHTML=h; };
  ask('🚚 Отгрузочные документы — '+esc(r.eu?'Европа':'Россия'), body, function(){
    var docs=[]; ['shinv|invoice','shpk|packing','shcmr|cmr','shtn|tn'].forEach(function(x){ var p=x.split('|'), e=el(p[0]); if(e&&e.checked&&!e.disabled) docs.push(p[1]); });
    if(!docs.length){ setm('shmsg','err','Отметьте хотя бы один документ'); return false; }
    var data={ fields:{ loadDate:ruDate(val('shd')), unloadPlace:val('shup').trim(), unloadCountry:val('shuc').trim(), instructions:val('shin').trim(), tractor:val('shtr').trim(), trailer:val('shtl').trim() }, docs:docs, blankId:val('shbl'), newBlank:!!TWSH.newBlank };
    run({vapi:'shipissue', deal:TWSH.deal, data:JSON.stringify(data)}, 'Выписываю документы…', 'shmsg').then(function(x){ if(!x) return;
      var res=x.results||{}, names={invoice:TWSH.r.invoiceTitle, packing:'Упаковочный лист', cmr:'CMR', tn:'ТН'}, h='';
      Object.keys(res).forEach(function(k){ var v=res[k]||{}; h+='<div>'+(v.ok?'✅':'❌')+' '+esc(names[k]||k)+(v.number?' № '+esc(v.number):'')+(v.blank?' '+esc(v.blank):'')+': '+(v.ok?(v.url?'<a href="'+esc(v.url)+'" target="_blank" rel="noopener">открыть</a>':'готово'):'<span class="err">'+esc(v.error||errText(v))+'</span>')+(v.ok&&v.error?' <span class="err">'+esc(v.error)+'</span>':'')+'</div>'; });
      el('shout').innerHTML=h; setm('shmsg','ok','Готово — окно можно закрыть'); el('askNo').textContent='Закрыть'; twShRefresh();
    });
    return false;
  }, 'Выписать');
  TWSH.renderLines();
}
function twShMode(nb){ TWSH.newBlank=!!nb; if(TWSH.renderLines) TWSH.renderLines(); }

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
    TWPK={ r:r, sel:0, products:null, pallets:(r.pallets||[]).map(function(p){ return { note:p.note||'', lines:(p.lines||[]).map(function(l){ return { productId:l.productId, sku:l.sku, name:l.name, nameEn:l.nameEn||'', internal:l.internal||'', qty:l.qty, boxes:l.boxes, netKg:l.netKg||'', grossKg:l.grossKg||'' }; }) }; }) };
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
/* наше имя товара (оборудование · модель с цветом) — по документному «Набор для домашнего гимнастического комплекса» башни не различить (владелец 16.10.2026) */
/* английское имя по товару — запасной путь для листов на паллеты, если строка пришла без него */
function twPkEn(pid){ if(!TWPK||!TWPK.r) return ''; var all=((TWPK.r.order?TWPK.r.order.items:TWPK.r.dealItems)||[]).concat(TWPK.products||[]); for(var i=0;i<all.length;i++) if(all[i].productId===pid&&all[i].nameEn) return all[i].nameEn; return ''; }
function twPkInternal(pid){ var all=((TWPK.r.order?TWPK.r.order.items:TWPK.r.dealItems)||[]).concat(TWPK.products||[]); for(var i=0;i<all.length;i++) if(all[i].productId===pid) return all[i].internal||''; return ''; }
/* покрытие и цвет крупной меткой (владелец 16.10.2026: «белый или лакированный?»): поле «цвет» у BusyKids пустое — берём из имени модели */
var TWPK_FIN=[[/\bLAK\b/i,'лак','ok'],[/\bWP\b/i,'шлифованный, без лака','warn'],[/\bWHITE\b/i,'белый','info'],[/\bGRAY\b|\bGREY\b/i,'серый','info'],[/\bBLUE\b/i,'синий','info'],
  [/\bBROWN\b/i,'коричневый','info'],[/\bPINK\b/i,'розовый','info'],[/\bBLACK\b/i,'чёрный','info'],[/\bDARK\b/i,'тёмный','info'],[/\bMDF\b/i,'МДФ','info'],[/\bUV\b/i,'УФ-печать','info']];
function twPkFinish(internal){ var m=String(internal||'').split(' · ').pop(), out=[];
  TWPK_FIN.forEach(function(f){ if(f[0].test(m)) out.push('<span class="pill '+f[2]+'" style="font-weight:700;margin-left:4px">'+f[1]+'</span>'); });
  return out.join(''); }
function twPkPool(){
  var r=TWPK.r, src=r.order?r.order.items:r.dealItems, placed={};
  TWPK.pallets.forEach(function(p){ p.lines.forEach(function(l){ placed[l.productId]=(placed[l.productId]||0)+(Number(l.qty)||0); }); });
  return (src||[]).map(function(it){ return { productId:it.productId, sku:it.sku, name:it.name, nameEn:it.nameEn||'', internal:it.internal||'', qty:it.qty, placed:placed[it.productId]||0, left:it.qty-(placed[it.productId]||0) }; });
}
function twPkCss(){ if(el('pkcss')) return; var st=document.createElement('style'); st.id='pkcss';
  st.textContent='.pk-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:var(--s-3);align-items:start}@media(max-width:760px){.pk-grid{grid-template-columns:1fr}}'
    +'.pk-pal{border:2px solid var(--line);border-radius:10px;padding:var(--s-2) var(--s-3);margin-top:var(--s-2);cursor:pointer}.pk-pal.on{border-color:var(--accent);background:var(--accent-bg,var(--card2))}'
    +'.pk-pal input{cursor:text}.pk-pal .hd{display:flex;align-items:center;gap:var(--s-2);flex-wrap:wrap}'
    +'.pk-ln{border-top:1px solid var(--line);padding:var(--s-1) 0}.pk-ln .nm{display:flex;align-items:center;gap:var(--s-2)}.pk-ln .nm span{flex:1;min-width:0}'
    +'.pk-ln .ins{display:flex;flex-wrap:wrap;gap:var(--s-2);margin-top:4px}.pk-ln .ins label{display:flex;align-items:center;gap:4px;font:var(--t-label);color:var(--muted)}.pk-ln .ins input{width:66px}'
    +'.pk-pool{position:sticky;top:0}.pk-pool .tbl-wrap{max-height:60vh}@media(max-width:760px){.pk-pool{position:static}}';
  document.head.appendChild(st); }
function twPkRender(){
  twPkCss();
  var r=TWPK.r, pool=twPkPool(), b=el('pkbody'); if(!b) return;
  if(TWPK.sel>=TWPK.pallets.length) TWPK.sel=TWPK.pallets.length-1; if(TWPK.sel<0) TWPK.sel=0;
  var selNo=TWPK.sel+1, leftAll=pool.reduce(function(s,it){ return s+Math.max(0,it.left); },0);
  var inp=function(i,j,k,v,step){ return '<input type="number" min="0" step="'+step+'" data-p="'+i+'" data-l="'+j+'" data-k="'+k+'" value="'+esc(v)+'" onclick="event.stopPropagation()"'+(k==='qty'?' onchange="twPkSync();twPkReweigh('+i+','+j+');twPkRender()"':'')+'>'; };
  // ── паллеты (слева): строка товара = имя + 4 поля, укладывается в любую ширину ──
  var pals=TWPK.pallets.map(function(p,i){
    var net=0, gross=0, boxes=0, qty=0; p.lines.forEach(function(l){ net+=Number(l.netKg)||0; gross+=Number(l.grossKg)||0; boxes+=Number(l.boxes)||0; qty+=Number(l.qty)||0; });
    var on=(i===TWPK.sel);
    var rows=p.lines.map(function(l,j){ return '<div class="pk-ln"><div class="nm"><span>'+esc(l.internal||twPkInternal(l.productId)||l.name)+twPkFinish(l.internal||twPkInternal(l.productId))+' <span class="muted">'+esc(l.sku)+'</span></span><button class="ic" title="снять с паллеты" onclick="twPkDel('+i+','+j+');event.stopPropagation()">🗑</button></div>'
      +'<div class="ins"><label>шт '+inp(i,j,'qty',l.qty,1)+'</label><label>кор. '+inp(i,j,'boxes',l.boxes,1)+'</label><label>нетто '+inp(i,j,'netKg',l.netKg,0.01)+'</label><label>брутто '+inp(i,j,'grossKg',l.grossKg,0.01)+'</label></div></div>'; }).join('');
    return '<div class="pk-pal'+(on?' on':'')+'" onclick="twPkSelect('+i+')">'
      +'<div class="hd"><b>Паллета '+(i+1)+'</b>'+(on?'<span class="pill ok">сюда кладём</span>':'<button class="sm sec" onclick="twPkSelect('+i+');event.stopPropagation()">выбрать</button>')+'<span class="sp"></span>'
      +'<button class="ic" title="выше" onclick="twPkMove('+i+',-1);event.stopPropagation()">↑</button><button class="ic" title="ниже" onclick="twPkMove('+i+',1);event.stopPropagation()">↓</button>'
      +(TWPK.pallets.length>1?'<button class="ic" title="убрать паллету" onclick="twPkDelPallet('+i+');event.stopPropagation()">✕</button>':'')+'</div>'
      +'<div class="sm muted">'+qty+' шт · '+boxes+' кор · нетто '+money(net)+' · брутто '+money(gross)+' кг</div>'
      +(rows||'<div class="sm muted" style="margin-top:var(--s-1)">пусто</div>')+'</div>';
  }).join('');
  var left='<div><div class="row" style="align-items:center"><b>Паллеты</b><span class="sm muted">'+TWPK.pallets.length+' шт</span><span class="sp"></span><button class="gho sm" onclick="twPkSync();twPalletSheets(TWPK.pallets)" title="листы на паллеты по тому, что сейчас в окне">🏷 Листы</button><button class="sec sm" onclick="twPkNew()">＋ Паллета</button></div>'+pals+'</div>';
  // ── что везём (справа): товары заказа сделки (нет заказа — позиции сделки), остаток, количество и кнопка на выбранную паллету ──
  var prow=pool.map(function(it,i){
    var over=it.left<0, done=it.left===0;
    return '<tr'+(over?' style="color:var(--red)"':done?' class="muted"':'')+'><td>'+esc(it.internal||it.name)+twPkFinish(it.internal)+'<div class="muted sm">'+esc(it.sku)+' · '+it.qty+' шт'+(it.placed?' · разложено '+it.placed:'')+'</div></td>'
      +'<td class="num">'+(over?'<b>лишнее '+(-it.left)+'</b>':done?'✓':('<input type="number" min="1" max="'+it.left+'" step="1" id="pkq'+i+'" value="'+it.left+'" style="width:64px">'))+'</td>'
      +'<td>'+(it.left>0?'<button class="sm" onclick="twPkAdd(\''+esc(it.productId)+'\','+i+')">→ Паллета '+selNo+'</button>':'')+'</td></tr>'; }).join('');
  var right='<div class="pk-pool"><div class="row" style="align-items:center"><b>Что везём</b><span class="sm muted">'+(r.order?esc(r.order.num):'позиции сделки')+' · осталось <b>'+leftAll+'</b> шт</span></div>'
    +'<div class="row" style="align-items:center;margin:var(--s-1) 0"><span class="sm">Кладём на:</span><select id="pktarget" onchange="twPkSelect(Number(this.value))">'+TWPK.pallets.map(function(p,i){ return '<option value="'+i+'"'+(i===TWPK.sel?' selected':'')+'>Паллета '+(i+1)+(p.lines.length?'':' (пустая)')+'</option>'; }).join('')+'</select></div>'
    +'<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Товар</th><th class="num">Штук</th><th></th></tr></thead><tbody>'+(prow||'<tr><td colspan="3" class="sm muted">нет товаров каталога</td></tr>')+'</tbody></table></div>'
    +(leftAll>0?'<div class="row" style="margin-top:var(--s-1)"><button class="gho sm" onclick="twPkAll()">Всё оставшееся → Паллета '+selNo+'</button></div>':'<div class="sm ok" style="margin-top:var(--s-1)">✓ Всё разложено</div>')
    +'<div class="row" style="margin-top:var(--s-2)"><input list="pkcat" id="pkadd" placeholder="другой товар: артикул или название" style="flex:1" onchange="twPkAddCatalog(this)"><button class="gho sm" onclick="twPkAddCatalog(el(\'pkadd\'))">＋ Паллета '+selNo+'</button></div>'
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
  if(ex){ ex.qty=(Number(ex.qty)||0)+n; ex.boxes=(Number(ex.boxes)||0)+n; ex.un=u.un; ex.ug=u.ug; twPkWeights(ex); } else { var l={ productId:it.productId, sku:it.sku, name:it.name, nameEn:it.nameEn||'', internal:it.internal||'', qty:n, boxes:n, netKg:'', grossKg:'', un:u.un, ug:u.ug }; twPkWeights(l); p.lines.push(l); } }
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

/* ── листы на паллеты (владелец 12.10.2026): на каждую паллету клеится лист A4 «что на ней лежит» — по образцу Google-документа «Order: OBJ-…»:
   Order: <заказ покупателя> · Palet #N · по строкам: артикул / <имя EN> Parts - / <шт> pcs. «Parts -» — обязательно (владелец).
   Оформление — в общем стиле Прохаба (tw-theme: Onest, --fg #151A24, --muted #667085, --line #E4E7EC, акцент --accent #2458C9 и подложка #EAF0FB),
   без логотипа и названия компании (владелец 13.10.2026). На паллете с длинным списком всё уменьшается (--k), пока не поместится на одну страницу. ── */
function twPalletSheets(pallets){
  var w=window.open('', '_blank');   // окно открываем сразу, в клике — иначе браузер сочтёт его всплывающим и заблокирует
  if(!w){ (typeof oops==='function'?oops:alert)('Браузер не дал открыть окно печати — разрешите всплывающие окна для сайта'); return; }
  w.document.write('<!doctype html><title>Листы на паллеты</title><body style="font-family:system-ui,sans-serif;padding:24px">Готовлю листы…</body>');
  var ref=TWSH&&TWSH.r&&TWSH.r.payInvoice?get({vapi:'euinvoiceget', invoice:TWSH.r.payInvoice}).then(function(r){ return (r&&r.ok&&r.terms&&r.terms.buyerRef)||''; }).catch(function(){ return ''; }):Promise.resolve('');
  var pk=pallets?Promise.resolve(pallets):get({vapi:'packget', deal:TWSH.deal}).then(function(r){ return (r&&r.ok&&r.pallets)||[]; });
  Promise.all([ref,pk]).then(function(a){
    var order=a[0]||(TWSH&&TWSH.r&&TWSH.r.deal&&TWSH.r.deal.num)||'', list=(a[1]||[]).filter(function(p){ return (p.lines||[]).length; });
    if(!list.length){ w.document.body.innerHTML='Паллет с товаром нет — сначала разложите товары в «Паллетовке».'; return; }
    w.document.open(); w.document.write(twPalletSheetsHtml(list, order)); w.document.close();
  });
}
/** HTML окна печати: страницы .pg по паллетам + подгонка размера под одну страницу (отдельно — чтобы проверять без всплывающего окна) */
function twPalletSheetsHtml(list, order){
  var n=list.length, today=new Date(), dd=function(x){ return (x<10?'0':'')+x; }, date=dd(today.getDate())+'.'+dd(today.getMonth()+1)+'.'+today.getFullYear();
  var pages=list.map(function(p,i){
    var total=0, lines=p.lines.map(function(l){ var nm=String(l.nameEn||twPkEn(l.productId)||l.name||'').trim(), q=Number(l.qty)||0;   // лист на паллету — только по-английски (владелец 16.10.2026) total+=q;
      return '<div class="ln"><div class="l"><div class="sku">'+esc(l.sku||'')+'</div><div class="nm">'+esc(nm)+' <span class="parts">Parts -</span></div></div>'
        +'<div class="r"><span class="q">'+esc(l.qty)+'</span><span class="u">pcs</span></div></div>'; }).join('');
    return '<div class="pg" style="--k:1"><div class="hd"><div><div class="lbl">Order</div><div class="val">'+esc(order)+'</div></div><div class="pill">'+(i+1)+' / '+n+'</div></div>'
      +'<div class="pal">Palet <span class="no">#'+(i+1)+'</span></div>'
      +'<div class="lines">'+lines+'</div>'
      +'<div class="ft"><span>Total on pallet: <b>'+total+' pcs</b></span><span>'+esc(date)+'</span></div></div>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Листы на паллеты — '+esc(order||'')+'</title>'
    +'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    +'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap"><style>'
    +'@page{size:A4 portrait;margin:0}html,body{margin:0;background:#EEF1F5;color:#151A24;font-family:Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}'
    +'.bar{position:sticky;top:0;z-index:2;background:#fff;padding:10px 16px;border-bottom:1px solid #E4E7EC;font:14px/20px Onest,system-ui,sans-serif;display:flex;gap:12px;align-items:center}'
    +'.bar button{font:inherit;font-weight:600;padding:7px 16px;border:0;border-radius:10px;background:#2458C9;color:#fff;cursor:pointer}'
    +'.pg{position:relative;background:#fff;width:210mm;height:297mm;box-sizing:border-box;padding:16mm 18mm 16mm;margin:12px auto;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(16,24,40,.05)}'
    +'.hd{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:5mm;border-bottom:1px solid #E4E7EC}'
    +'.lbl{font-size:9pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:1mm}.val{font-size:16pt;font-weight:600}'
    +'.pill{font-size:10pt;font-weight:600;color:#667085;background:#EEF1F5;border-radius:999px;padding:1.6mm 3.5mm}'
    +'.pal{font-size:calc(52pt * var(--k));font-weight:800;line-height:1.05;letter-spacing:-.02em;margin:calc(7mm * var(--k)) 0 calc(5mm * var(--k))}.pal .no{color:#2458C9}'
    +'.lines{flex:1;min-height:0}'
    +'.ln{display:flex;align-items:center;justify-content:space-between;gap:8mm;padding:calc(4.2mm * var(--k)) 0;border-top:1px solid #E4E7EC}'
    +'.ln .l{min-width:0;flex:1}.sku{font-size:calc(12pt * var(--k));font-weight:600;letter-spacing:.06em;color:#667085;margin-bottom:calc(1.4mm * var(--k))}'
    +'.nm{font-size:calc(21pt * var(--k));font-weight:600;line-height:1.22}.nm .parts{color:#667085;font-weight:500;white-space:nowrap}'
    +'.ln .r{display:flex;align-items:baseline;gap:calc(2mm * var(--k));white-space:nowrap;background:#EAF0FB;color:#2458C9;border-radius:calc(3mm * var(--k));padding:calc(2mm * var(--k)) calc(4mm * var(--k))}'
    +'.q{font-weight:800;font-size:calc(36pt * var(--k));line-height:1;letter-spacing:-.02em}.u{font-size:calc(13pt * var(--k));font-weight:600}'
    +'.ft{display:flex;justify-content:space-between;align-items:center;padding-top:4mm;border-top:1px solid #E4E7EC;font-size:10pt;color:#667085}.ft b{color:#151A24;font-weight:700}'
    +'@media print{html,body{background:#fff}.bar{display:none}.pg{margin:0;box-shadow:none;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}.ln .r{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    +'</style></head><body><div class="bar"><b>Листы на паллеты</b><span>'+n+' шт · по одному листу A4 на паллету</span><button onclick="window.print()">🖨 Печать</button></div>'+pages
    +'<script>(function(){function fit(){var ps=document.querySelectorAll(".pg");for(var i=0;i<ps.length;i++){var p=ps[i],b=p.querySelector(".lines"),k=1;p.style.setProperty("--k",1);while(b.scrollHeight>b.clientHeight+1&&k>0.28){k=Math.round((k-0.03)*100)/100;p.style.setProperty("--k",k);}}}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);})();<\/script></body></html>';
}

/* ── стикеры на коробки (владелец 13.10.2026): наклейка 40×30 мм (образцы — 472×354 px при 300 dpi) на каждый товар заказа на производство:
   артикул · имя EN заглавными + «PARTS» · MADE IN BELARUS · второстепенно номер партии латиницей (ПАРТ-4 → PART4). Печать на принтере наклеек:
   страница = наклейка, @page 40mm 30mm без полей; имя уменьшается, пока не поместится. Чёрно-белое — термопринтер цвета не печатает. ── */
function twBoxStickers(){
  var w=window.open('', '_blank');
  if(!w){ (typeof oops==='function'?oops:alert)('Браузер не дал открыть окно печати — разрешите всплывающие окна для сайта'); return; }
  w.document.write('<!doctype html><title>Стикеры на коробки</title><body style="font-family:system-ui,sans-serif;padding:24px">Готовлю стикеры…</body>');
  get({vapi:'packget', deal:TWSH.deal}).then(function(r){
    if(!r||!r.ok){ w.document.body.innerHTML=esc(errText(r)); return; }
    var items=(r.order?r.order.items:r.dealItems)||[], part=r.order?String(r.order.num||'').replace(/^ПАРТ-/,'PART'):'';
    var seen={}, list=items.filter(function(it){ if(!it.sku||seen[it.sku]) return false; seen[it.sku]=1; return true; });
    if(!list.length){ w.document.body.innerHTML='В заказе нет товаров каталога — стикеры делать не из чего.'; return; }
    w.document.open(); w.document.write(twBoxStickersHtml(list, part)); w.document.close();
  });
}
/** Имя на стикере: таможенное имя без модели в скобках (как в образцах) + исполнение из скобок, если в имени его нет:
 *  «… Activity Stand (BK Tower Foldable LAK)» → «… Activity Stand LAK» — как уже пишется WHITE (владелец 14.10.2026). */
var TW_FINISH=/\b(LAK|WP|WHITE|BLUE|PINK|BROWN|GRAY|GREY|BLACK|DARK|NATURAL)\b/gi;
function twStickerName(en){
  var s=String(en||''), m=/\s*\(([^)]*)\)\s*$/.exec(s), main=s.replace(/\s*\([^)]*\)\s*$/,'').trim();
  if(!m || new RegExp(TW_FINISH.source,'i').test(main)) return main;   // исполнение уже в имени (WHITE, BLUE) — как есть; «WHITE+LAK» не превращаем в «WHITE LAK»
  var t=m[1].match(new RegExp(TW_FINISH.source,'i'));
  return t?main+' '+t[0].toUpperCase():main;
}
function twBoxStickersHtml(list, part){
  var st=list.map(function(it, i){ var nm=twStickerName(it.nameEn||it.name);
    return '<div class="cell"><div class="st" id="st'+i+'" data-sku="'+esc(it.sku)+'" style="--k:1"><div class="sku">'+esc(it.sku)+'</div><div class="nm"><span class="in">'+esc(nm)+' <b>PARTS</b></span></div>'
      +'<div class="ft"><span>MADE IN BELARUS</span>'+(part?'<span class="pt">'+esc(part)+'</span>':'')+'</div></div>'
      +'<div class="cap"><span>'+esc(it.internal||it.name||'')+'</span><button onclick="pdfOne('+i+')" title="скачать этот стикер файлом PDF 40×30 мм">⬇ PDF</button></div></div>'; }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Стикеры на коробки'+(part?' — '+esc(part):'')+'</title>'
    +'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    +'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap"><style>'
    +'@page{size:40mm 30mm;margin:0}html,body{margin:0;background:#EEF1F5;color:#000;font-family:Onest,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}'
    +'.bar{position:sticky;top:0;z-index:2;background:#fff;padding:10px 16px;border-bottom:1px solid #E4E7EC;font:14px/20px Onest,system-ui,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap}'
    +'.bar button{font:inherit;font-weight:600;padding:7px 16px;border:0;border-radius:10px;background:#2458C9;color:#fff;cursor:pointer}.bar .sm{color:#667085}'
    +'.wrap{display:flex;flex-wrap:wrap;gap:16px 12px;padding:16px}.cell{width:40mm}'
    +'.cap{margin-top:6px;font:12px/16px Onest,system-ui,sans-serif;color:#344054;display:flex;flex-direction:column;gap:4px;align-items:flex-start}'
    +'.cap button{font:inherit;font-weight:600;padding:3px 10px;border:1px solid #D0D5DD;border-radius:8px;background:#fff;color:#2458C9;cursor:pointer}'
    +'.st{background:#fff;width:40mm;height:30mm;box-sizing:border-box;padding:2.2mm 2mm 1.8mm;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;outline:1px dashed #D0D5DD}'
    +'.sku{font-size:9.5pt;font-weight:800;letter-spacing:.1em;line-height:1.1;flex:none}'
    +'.nm{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;font-size:calc(8.6pt * var(--k));font-weight:500;letter-spacing:.06em;line-height:1.22;text-transform:uppercase;padding:1mm 0}.nm b{font-weight:800}'
    +'.ft{flex:none;display:flex;justify-content:center;align-items:baseline;gap:2mm;font-size:5.2pt;font-weight:500;letter-spacing:.14em}.ft .pt{font-weight:700;color:#555}'
    +'@media print{html,body{background:#fff}.bar,.cap{display:none}.cell{width:auto}.wrap{display:block;padding:0}.st{outline:0;margin:0;page-break-after:always;break-after:page}.st:last-child{page-break-after:auto;break-after:auto}}'
    +'</style></head><body><div class="bar"><b>Стикеры на коробки</b><span>'+list.length+' шт · наклейка 40×30 мм, по одной на товар'+(part?' · '+esc(part):'')+'</span><button onclick="window.print()">🖨 Печать</button>'
    +'<span class="sm">Размер страницы 40×30 мм и нулевые поля заданы самой страницей — в окне печати Chrome ничего выбирать не нужно, только число копий</span></div><div class="wrap">'+st+'</div>'
    +'<script>(function(){function fit(){var ss=document.querySelectorAll(".st");for(var i=0;i<ss.length;i++){var s=ss[i],b=s.querySelector(".nm"),k=1;s.style.setProperty("--k",1);while(b.scrollHeight>b.clientHeight+1&&k>0.45){k=Math.round((k-0.04)*100)/100;s.style.setProperty("--k",k);}}}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);})();'
    +'var LIBS=null;function libs(){if(LIBS)return LIBS;function js(u){return new Promise(function(ok,no){var s=document.createElement("script");s.src=u;s.onload=ok;s.onerror=function(){no(new Error("не загрузилась библиотека "+u))};document.head.appendChild(s);});}'
    +'LIBS=js("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(function(){return js("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");});LIBS.catch(function(){LIBS=null;});return LIBS;}'
    +'function pdfOne(i){var el=document.getElementById("st"+i);libs().then(function(){el.style.outline="0";return html2canvas(el,{scale:8,backgroundColor:"#fff"});})'
    +'.then(function(cv){el.style.outline="";var doc=new jspdf.jsPDF({unit:"mm",format:[40,30],orientation:"landscape"});doc.addImage(cv.toDataURL("image/png"),"PNG",0,0,40,30,undefined,"FAST");doc.save((el.getAttribute("data-sku")||"sticker")+".pdf");})'
    +'.catch(function(e){el.style.outline="";alert("PDF не получился: "+(e&&e.message||e));});}'
    +'<\/script></body></html>';
}
