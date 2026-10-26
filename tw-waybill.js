/* Диалог накладной ТН/ТТН (бриф 30.09.2026): один на карточку сделки (sales.html), карточку договора (contract.html) и реестр (salesdocs.html).
   wbprep(deal, kind) → дата отгрузки (= дата накладной; по умолчанию правка накладной / дата забора / дата доставки), адрес доставки
   (правка / «Адрес доставки ЮЛ» / адрес сделки), заказчик перевозки (договор → amoCRM → «Мы»), водитель, автомобиль, прицеп, путевой лист,
   места/масса по позициям → wbissue(deal, kind, data) сохраняет всё у сделки (waybill.ts saveWaybillData) и формирует документ.
   Ждёт от страницы: get, run, ask, hide, info, oops, errText, el, val, esc, setm, money. twWaybill(dealKey, 'ТН'|'ТТН'|'ТТН Юрлицо'|'Товарный чек', onDone).
   07.10.2026: бланк — резерв сделки / следующий свободный / выбрать; ТН и товарный чек — только дата (перевозку и места печатает лишь ТТН);
   16.10.2026 (владелец): накладная — только на то, что везём: колонка «Отгружаем» (остаток, не больше упакованного по заказу), остаток — следующей
   накладной на новом бланке (newBlank), прежние остаются; единственную неподписанную можно переформировать на том же бланке.
   twWaybillBlock(dealKey, box, onDone) — блок «Накладные» карточек сделки и договора: что выписывать по договору, резерв бланка,
   накладные карточками со статусом «выписана / подписана» и загрузкой подписанного скана, «выписано · оплачено ЕРИП · закрыта». */
var TWWB=null;
function twWaybill(dealKey, kind, onDone){
  get({vapi:'wbprep', deal:dealKey, kind:kind}).then(function(p){
    if(!p||!p.ok){ oops(errText(p)); return; }
    TWWB=p; TWWB.__kind=kind; TWWB.__deal=dealKey; TWWB.__partial=Array.isArray(p.prev);
    var items=p.items||[];
    var miss=(p.missing&&p.missing.length)?('<div class="note warn"><div>⚠ Не хватает для накладной: '+esc(p.missing.join(', '))+'</div></div>'):'';
    // не рамочный договор: ТН должна сходиться с суммой договора (владелец 14.10.2026 — предупреждаем, не запрещаем; частичная отгрузка — по сумме ТН):
    // считается на лету по колонке «Отгружаем» (twWbCheck), сервер даёт contractSum {number, amount, issued}
    miss+='<div class="note warn" id="wbcc" style="display:none"><div></div></div>';
    // строки накладной (07.10.2026): комплект — одной строкой (места/масса комплекса), остальное — своими строками; 0 — подсветка.
    // Частичная отгрузка (16.10.2026): «Отгружаем» — сколько везём этой накладной (умолчание: остаток, не больше упакованного по заказу);
    // места/масса по умолчанию пересчитываются пропорционально, пока их не ввели руками
    // накладная по двум счетам (27.10.2026): строки других открытых сделок клиента с остатком — ниже своих, «отгружаем» по умолчанию 0
    (p.others||[]).forEach(function(o){ (o.items||[]).forEach(function(it){ it.deal=o.dealId; it.dealNum=o.num; items.push(it); }); });
    TWWB.items=items;
    var tn0=!!p.tn, partial=Array.isArray(p.prev), anyPrev=partial&&(items.some(function(it){ return Number(it.shipped)>0; })||(p.prev||[]).length>0);   // partial — сервер умеет частичную отгрузку
    items.forEach(function(it){ it.shipped0=Number(it.shipped)||0; it.places0=Number(it.places)||0; it.mass0=Number(it.mass)||0; it.qty0=Number(it.qty)||0; });
    var rows=items.map(function(it,i){
      var z=function(v){ return Number(v)>0?'':' style="border-color:var(--red);background:var(--red-bg)"'; };
      var pk=(it.packed!=null)?'<div class="sm muted">упаковано по заказу: '+esc(it.packed)+'</div>':'';
      var head=(it.deal&&(i===0||items[i-1].deal!==it.deal))?'<tr><td colspan="9" class="muted" style="padding-top:var(--s-3)">Также везём по <b>'+esc(it.dealNum||'')+'</b> того же клиента — впишите, сколько из остатка</td></tr>':'';
      return head+'<tr id="wbr'+i+'"'+(it.deal?' style="background:var(--surface-2,transparent)"':'')+'><td data-l="Наименование">'+esc(it.name)+(it.set?' <span class="pill info">комплект</span>':'')+(it.model&&it.model!==it.name?'<div class="sm">'+esc(it.model)+'</div>':'')+pk+'</td>'
        +'<td data-l="Заказано" class="num">'+esc(it.qty)+' '+esc(it.unit||'')+'</td>'
        +(anyPrev?'<td data-l="Уже в накладных" class="num" id="wbs'+i+'">'+esc(it.shipped0)+'</td>':'')
        +(partial?'<td data-l="Отгружаем"><input type="number" min="0" max="'+esc(it.qty)+'" step="1" id="wbq'+i+'" value="'+esc(it.ship)+'" oninput="twWbShip('+i+',this.value)" autocomplete="off" style="width:5.5em"></td>':'')
        +(tn0?'':'<td data-l="Мест"><input type="number" min="0" id="wbp'+i+'" value="'+esc(it.places)+'"'+z(it.places)+' oninput="TWWB.items['+i+'].places=this.value;TWWB.items['+i+'].pm=1;twWbSums()" autocomplete="off"></td>'
        +'<td data-l="Масса, кг"><input type="number" min="0" step="0.01" id="wbm'+i+'" value="'+esc(it.mass)+'"'+z(it.mass)+' oninput="TWWB.items['+i+'].mass=this.value;TWWB.items['+i+'].pm=1;twWbSums()" autocomplete="off"></td>')+'</tr>';
    }).join('');
    // одна живая накладная этого вида и не подписана — можно переформировать на том же бланке; иначе эта — ещё одна, на новом бланке
    var prev=p.prev||[], canRedo=prev.length===1&&!prev[0].signed, anyLeft=items.some(function(it){ return Number(it.left)>0; });
    TWWB.__newBlank=partial&&prev.length>0&&(!canRedo||anyLeft);
    var modeSel='';
    if(canRedo) modeSel='<div class="note" style="margin-top:var(--s-2)"><div>По сделке уже есть '+esc(p.kind)+' <b>'+esc(prev[0].blank)+'</b> от '+esc(prev[0].date)+' на '+twWbMoney(prev[0].sum)+'.'
      +'<label style="display:block;margin-top:var(--s-1)"><input type="radio" name="wbmode" value="new"'+(TWWB.__newBlank?' checked':'')+' onchange="twWbMode(1)"> ➕ Ещё одна накладная на новом бланке — на остаток (частичная отгрузка)</label>'
      +'<label style="display:block"><input type="radio" name="wbmode" value="redo"'+(TWWB.__newBlank?'':' checked')+' onchange="twWbMode(0)"> ♻️ Переформировать её заново на том же бланке (прежняя отменится)</label></div></div>';
    else if(prev.length) modeSel='<div class="note" style="margin-top:var(--s-2)"><div>По сделке уже '+prev.length+' '+esc(p.kind)+(prev.length===1?' (подписана)':'')+' — эта будет ещё одной, на новом бланке. Лишнюю можно отменить в блоке «Накладные».</div></div>';
    var zeroNote='<div class="note warn" id="wbzero" style="margin-top:var(--s-2);display:none"><div>⚠ У подсвеченных строк не заданы места или масса — в каталоге нет данных. Впишите их: значения сохранятся в сделке.</div></div>';
    // сетка полей — своими стилями: страницы реестра/договора не обязаны иметь .grid2/.fl
    var L='display:block;margin-top:var(--s-2)', SM='display:block;font:var(--t-small);color:var(--muted);margin-bottom:var(--s-1)';
    var inp=function(id,label,v,ph){ return '<label style="'+L+'"><span style="'+SM+'">'+label+'</span><input id="'+id+'" value="'+esc(v||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off" style="width:100%"></label>'; };
    var bl=p.blank, blankSel='';
    if(bl){
      var opts=[], seen={};
      if(bl.reserved){ opts.push('<option value="'+esc(bl.reserved.id)+'" selected>'+esc(bl.reserved.label)+' — зарезервирован за сделкой</option>'); seen[bl.reserved.id]=1; }
      (bl.free||[]).forEach(function(b,i){ if(seen[b.id]) return; opts.push('<option value="'+esc(b.id)+'"'+(!bl.reserved&&i===0?' selected':'')+'>'+esc(b.label)+(i===0?' — следующий свободный':'')+'</option>'); });
      blankSel='<label style="'+L+'"><span style="'+SM+'">🧾 Бланк '+esc(p.kind==='ТТН Юрлицо'?'ТТН':p.kind)+' (номер на бумаге)</span><select id="wbbl" style="width:100%">'+(opts.join('')||'<option value="">свободных бланков нет</option>')+'</select></label>';
    }
    if(p.simple){
      var sbody=miss+'<div class="sm" style="margin-bottom:var(--s-2)">Клиент: <b>'+esc(p.client)+'</b>'+(p.contract?(' · '+esc(p.contract)):'')+(p.num?(' · заказ '+esc(p.num)):'')+'</div>'
        +(p.note?'<div class="note"><div>'+esc(p.note)+'</div></div>':'')
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+inp('wbd','📅 Дата '+(p.kind==='Товарный чек'?'чека':'накладной')+' — проверьте!', p.date, 'дд.мм.гггг')+blankSel+'</div>'
        +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="wbc"> Я проверил <b>дату</b></label><div class="msg" id="wbm"></div>';
      ask('✍️ '+(p.kind==='Товарный чек'?'Товарный чек':'Выписать '+esc(p.title||kind)), sbody, function(){
        var date=val('wbd').trim();
        if(!date){ setm('wbm','err','Укажите дату'); return false; }
        if(!el('wbc').checked){ setm('wbm','err','Отметьте, что проверили дату'); return false; }
        twWbSend(dealKey, kind, { date:date, blankId:(el('wbbl')&&el('wbbl').value)||'' }, onDone); return false;
      }, p.kind==='Товарный чек'?'Сформировать чек':'Сформировать накладную');
      return;
    }
    var tn=!!p.tn, trans=''
      +'<label style="'+L+'"><span style="'+SM+'">Заказчик перевозки (плательщик)</span><select id="wbf" style="width:100%"><option value="Мы"'+(p.freight!=='Клиент'?' selected':'')+'>Мы (ООО «Тигервуд»)</option><option value="Клиент"'+(p.freight==='Клиент'?' selected':'')+'>Клиент (грузополучатель)</option></select></label>'
      +inp('wbdr','Водитель (фамилия, инициалы)', p.driver)+inp('wbcar','Автомобиль (марка, гос. номер)', p.car)+inp('wbtr','Прицеп', p.trailer)+inp('wbpl','Путевой лист №', p.waybillDoc);
    var proxy=inp('wbrc','Товар к доставке принял (должность, Ф.И.О.)', p.recipient)+inp('wbpx','Доверенность (номер, дата)', p.proxy, 'например, № 23 от 11.05.2026')+inp('wbpb','Доверенность выдана (организация)', p.proxyBy);
    var body=miss
      +'<div class="sm" style="margin-bottom:var(--s-2)">Клиент: <b>'+esc(p.client)+'</b>'+(p.contract?(' · '+esc(p.contract)):' · <span class="err">договор не привязан</span>')+(p.num?(' · заказ '+esc(p.num)):'')+'</div>'
      +(p.note?'<div class="note"><div>'+esc(p.note)+'</div></div>':'')
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'
      +inp('wbd','📅 Дата отгрузки (= дата накладной) — проверьте!', p.date, 'дд.мм.гггг')
      +blankSel
      +(tn?'':'<label style="'+L+';grid-column:1 / -1"><span style="'+SM+'">📍 Адрес доставки (пункт разгрузки) — проверьте!</span><input id="wba" value="'+esc(p.address)+'" autocomplete="off" style="width:100%"></label>')
      +'</div>'
      +modeSel
      +((tn&&!partial)?'':'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm mob wbt"><thead><tr><th>Наименование</th><th class="num">'+(partial?'Заказано':'Кол-во')+'</th>'+(anyPrev?'<th class="num">Уже в накладных</th>':'')+(partial?'<th>Отгружаем</th>':'')+(tn?'':'<th>Мест</th><th>Масса, кг</th>')+'</tr></thead>'
        +'<tbody>'+rows+'<tr style="font-weight:600"><td>Итого</td><td></td>'+(anyPrev?'<td></td>':'')+(partial?'<td data-l="Отгружаем" id="wbtq">0</td>':'')+(tn?'':'<td data-l="Мест" id="wbtp">0</td><td data-l="Масса, кг" id="wbtm">0</td>')+'</tr></tbody></table></div>'+(tn?'':zeroNote))
      +(tn
        ?'<details style="margin-top:var(--s-3)"><summary class="sm">🚚 Перевозка и доверенность — если нужно заполнить в накладной</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+proxy+trans+'</div></details>'
        :'<div class="sm" style="margin-top:var(--s-3);font-weight:600">🚚 Перевозка</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+trans+'</div>')
      +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="wbc"> Я проверил <b>дату</b>'+(tn?'':' и <b>адрес</b>')+'</label>'
      +'<div class="msg" id="wbm"></div>';
    ask('✍️ Выписать '+esc(p.title||kind), body, function(){
      var date=val('wbd').trim(), addr=el('wba')?val('wba').trim():undefined;
      if(!date){ setm('wbm','err','Укажите дату накладной'); return false; }
      if(!el('wbc').checked){ setm('wbm','err','Отметьте, что проверили дату'+(tn?'':' и адрес')); return false; }
      var payload={ date:date, freight:val('wbf'), driver:val('wbdr').trim(), car:val('wbcar').trim(), trailer:val('wbtr').trim(), waybillDoc:val('wbpl').trim(),
        recipient:twWbVal('wbrc').trim(), proxy:twWbVal('wbpx').trim(), proxyBy:twWbVal('wbpb').trim(), blankId:(el('wbbl')&&el('wbbl').value)||'' };
      if(addr!==undefined) payload.address=addr;
      // «Отгружаем» — у всех строк; места/масса: ТТН — из окна (под отгружаемое), ТН — как были (в ТН не печатаются, строку сделки не трогаем)
      if(TWWB.__partial){
        payload.items=(TWWB.items||[]).map(function(it){ return {id:it.id||'', deal:it.deal||'', kids:it.kids||[], ship:Number(it.ship)||0, places:tn?it.places0:(Number(it.places)||0), mass:tn?it.mass0:(Number(it.mass)||0)}; });
        payload.newBlank=!!TWWB.__newBlank;
        if(!(TWWB.items||[]).some(function(it){ return Number(it.ship)>0; })){ setm('wbm','err','Укажите, что отгружаем: количество хотя бы в одной строке'); return false; }
      } else if(!tn) payload.items=(TWWB.items||[]).map(function(it){ return {id:it.id||'', kids:it.kids||[], places:Number(it.places)||0, mass:Number(it.mass)||0}; });
      if(!tn){
        var zr=(TWWB.items||[]).filter(function(it){ return Number(it.ship)>0 && (!(Number(it.places)>0) || !(Number(it.mass)>0)); });
        if(zr.length && !TWWB.__zeroOk){ TWWB.__zeroOk=1; setm('wbm','err','⚠ У '+zr.length+' строк(и) места или масса = 0 — заполните или нажмите «Сформировать» ещё раз, чтобы выписать так'); return false; }
      }
      twWbSend(dealKey, kind, payload, onDone);
      return false;   // окно закроем после ответа сервера
    }, 'Сформировать накладную');
    twWbDlg('dlg md');
    el('askNo').onclick=function(){ hide('askmodal'); twWbDlg('dlg'); };
    if(TWWB.__partial) twWbMode(TWWB.__newBlank?1:0, true); else twWbSums();
  }).catch(function(e){ oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twWbSend(dealKey, kind, payload, onDone){
  var chk=(kind==='Товарный чек');
  run({vapi:'wbissue', deal:dealKey, kind:kind, data:JSON.stringify(payload)}, chk?'Формирую товарный чек…':'Формирую накладную…', 'wbm').then(function(r){ if(!r) return;
    twWbDlg('dlg'); hide('askmodal');
    info(chk?'Товарный чек сформирован':'Накладная сформирована', '<div>✅ '+esc(chk?'Товарный чек б/н':kind)+(r.waybill?(' · бланк <b>'+esc(r.waybill)+'</b>'):'')+': <a href="'+esc(r.url)+'" target="_blank" rel="noopener">открыть</a></div>'
      +'<div class="sm" style="margin-top:var(--s-2)">Когда клиент подпишет — загрузите скан в блоке «Накладные» («⬆ Подписанный скан»): статус станет «подписана».</div>');
    if(onDone) onDone(r);
  });
}

/* ══════════ блок «Накладные» (07.10.2026) ══════════ */
var TWWBB={};
function twWbMoney(n){ return (typeof money==='function')?money(n):(Number(n)||0).toFixed(2); }
function twWaybillBlock(dealKey, box, onDone){
  if(typeof box==='string') box=el(box); if(!box) return;
  TWWBB={ deal:dealKey, box:box, done:onDone };
  box.innerHTML='<div class="sm">Загружаю накладные…</div>';
  get({vapi:'wbdocs', deal:dealKey}).then(function(r){
    if(!r||!r.ok){ box.innerHTML='<div class="sm err">Накладные не загрузились: '+esc(errText(r))+'</div>'; return; }
    TWWBB.r=r; twWbRender();
  }).catch(function(e){ box.innerHTML='<div class="sm err">Связь оборвалась: '+esc((e&&e.message)||e)+'</div>'; });
}
function twWbRefresh(){ twWaybillBlock(TWWBB.deal, TWWBB.box, TWWBB.done); if(TWWBB.done) TWWBB.done(); }
function twWbRender(){
  var r=TWWBB.r, h='', docs=r.docs||[], live=docs.filter(function(d){ return d.status==='formed'; });
  if(r.issued>0) h+='<div class="row" style="margin-bottom:var(--s-2);align-items:center"><span class="sm">Выписано на <b>'+twWbMoney(r.issued)+'</b> · оплачено ЕРИП <b>'+twWbMoney(r.paid)+'</b></span>'
    +(r.closed?'<span class="pill ok">✅ оплачено полностью</span>':'<span class="pill warn">⏳ ждём оплату '+twWbMoney(Math.max(0,r.issued-r.paid))+'</span>')+'</div>';
  h+=docs.map(function(d){
    var chk=d.docType==='receipt', bad=d.status!=='formed', ttl=chk?'Товарный чек':d.type;
    var pills=bad?'<span class="pill bad">ошибка формирования</span>':d.signedAt?'<span class="pill ok">подписана '+esc(d.signedAt)+'</span>':'<span class="pill warn">выписана — ждёт подписи</span>';
    var pdf=(!bad&&!chk)?'<a href="#" onclick="twWbPdf(\''+esc(d.id)+'\');return false;" title="одна страница A4, без сетки — для печати на бланке">🖨 PDF для печати</a>':'';
    var acts=bad?'':pdf+(d.signedAt?('<a href="'+esc(d.signedUrl)+'" target="_blank" rel="noopener">скан ↗</a><a href="#" onclick="twWbUnsign(\''+esc(d.id)+'\');return false;">убрать скан</a>')
      :'<button class="sec sm" onclick="twWbSignDlg(\''+esc(d.id)+'\')">⬆ Подписанный скан</button>');
    return twFileCard({ href:d.url, tab:1, tag:chk?'ЧЕК':d.type, title:ttl+' '+(d.blank||''), meta:[d.date, twWbMoney(d.sum)+' '+(d.currency||'BYN'), d.qty!=null?(d.qty+' шт.'):'', d.error].filter(Boolean).join(' · '),
      pills:pills, acts:acts, del:"twWbCancel('"+(d.cancelType||ttl)+"','"+esc(d.id)+"')", delTitle:'Отменить '+(chk?'чек':'накладную') });
  }).join('');
  var btns='', resv='', kinds={};
  (r.options||[]).forEach(function(o){
    btns+='<button class="sec sm" onclick="twWaybill(TWWBB.deal,\''+esc(o.kind)+'\',twWbRefresh)" title="'+esc(o.note||'')+'">✍️ '+esc(o.label)+'</button>';
    if(o.blank && !kinds[o.blank]) kinds[o.blank]=1;
  });
  Object.keys(kinds).forEach(function(k){
    var rs=r.reserved&&r.reserved[k], has=live.some(function(d){ return k==='tn'?d.type==='ТН':d.type==='ТТН'; });
    if(rs) resv+='<span class="pill info">📌 бланк '+esc(rs.label)+' за этим заказом</span><a href="#" class="sm" onclick="twWbUnreserve(\''+k+'\');return false;">снять резерв</a>';
    else if(!has) resv+='<button class="gho sm" onclick="twWbReserveDlg(\''+k+'\')">📌 Зарезервировать бланк '+(k==='tn'?'ТН':'ТТН')+'</button>';
  });
  var note=(r.options||[]).length===1&&r.options[0].note?'<span class="sm">'+esc(r.options[0].note)+'</span>':'';
  if(!(r.options||[]).length&&r.hint) note='<span class="sm warn">'+esc(r.hint)+'</span>';
  h+='<div class="row" style="margin-top:var(--s-2);align-items:center">'+btns+resv+note+'</div><div class="msg" id="twwbmsg"></div>';
  TWWBB.box.innerHTML=h;
}
/** PDF накладной для печати (07.10.2026): сервер выгружает лист на одну страницу A4 без сетки — открываем в новой вкладке */
function twWbPdf(id){
  var w=window.open('', '_blank'); if(w) w.document.write('<p style="font:16px sans-serif;padding:24px">Готовлю PDF для печати…</p>');
  get({vapi:'wbpdf', id:id}).then(function(r){
    if(!r||!r.ok){ if(w) w.close(); oops(errText(r)); return; }
    var bin=atob(r.b64), arr=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    var name=r.name||'документ.pdf', url=URL.createObjectURL(new Blob([arr],{type:'application/pdf'})), save=url;
    // 19.10.2026: файл по одноразовой ссылке сервера (10 минут) — имя задаёт сервер, верное при любом способе сохранения (значок просмотрщика, Cmd+S, Safari);
    // старый сервер без dl — как раньше, из памяти браузера
    if(r.dl && window.TW_CFG && TW_CFG.hub){ var base=String(TW_CFG.hub).replace(/\/exec$/,'')+'/dl/'+encodeURIComponent(r.dl); url=base; save=base+'?a=1'; }
    if(!w){ var a=document.createElement('a'); a.href=save; a.download=name; document.body.appendChild(a); a.click(); a.remove(); return; }
    // 19.10.2026: PDF из памяти браузера сохранялся под случайным именем — страница с документом и кнопкой «Сохранить» с именем документа
    w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(name)+'</title><style>html,body{margin:0;height:100%;font:14px system-ui,sans-serif}'
      +'.bar{display:flex;gap:12px;align-items:center;padding:8px 16px;border-bottom:1px solid #E4E7EC;background:#fff}.bar b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.bar a{font-weight:600;padding:8px 16px;border-radius:8px;background:#2458C9;color:#fff;text-decoration:none;white-space:nowrap}iframe{border:0;width:100%;height:calc(100% - 52px)}</style></head>'
      +'<body><div class="bar"><b>'+esc(name)+'</b><a href="'+save+'" download="'+esc(name)+'">⬇ Сохранить</a></div><iframe src="'+url+'"></iframe></body></html>');
    w.document.close();
  }).catch(function(e){ if(w) w.close(); oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twWbSignDlg(id, after){
  var today=new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
  ask('Подписанный скан', '<div class="sm">Скан или фото накладной (чека), подписанной клиентом. После загрузки — статус «подписана».</div>'
    +'<label style="display:block;margin-top:var(--s-3)"><span class="sm">Дата подписи</span><input type="date" id="twsd" value="'+today+'" autocomplete="off" style="width:100%"></label>'
    +'<label style="display:block;margin-top:var(--s-2)"><span class="sm">Файл (PDF или фото, до 15 МБ)</span><input type="file" id="twsf" accept="application/pdf,image/*" style="width:100%"></label><div class="msg" id="twsm"></div>',
    function(){
      var f=el('twsf').files[0], d=val('twsd');
      if(!f){ setm('twsm','err','Выберите файл'); return false; }
      if(f.size>15*1024*1024){ setm('twsm','err','Файл больше 15 МБ — сожмите фото или сохраните PDF'); return false; }
      var rd=new FileReader();
      rd.onload=function(){ var b64=String(rd.result).split(',')[1]||'';
        run({vapi:'wbsign', id:id, b64:b64, name:f.name||'', mime:f.type||'', date:d?d.split('-').reverse().join('.'):''}, 'Загружаю скан…', 'twsm').then(function(x){ if(!x) return; hide('askmodal'); (after||twWbRefresh)(); }); };
      rd.onerror=function(){ setm('twsm','err','Не удалось прочитать файл'); };
      rd.readAsDataURL(f); return false;
    }, 'Загрузить');
}
function twWbUnsign(id, after){
  ask('Убрать скан?', '<div>Скан уйдёт в корзину Google Drive, накладная снова станет «выписана».</div>', function(){
    run({vapi:'wbsignremove', id:id}, 'Убираю скан…', 'twwbmsg').then(function(x){ if(x) (after||twWbRefresh)(); }); }, 'Убрать скан');
}
function twWbCancel(type, id){   // id — одна накладная из нескольких (частичная отгрузка); без id — все документы вида
  var chk=type==='Товарный чек';
  ask('Отменить '+(chk?'товарный чек':type)+'?', '<div>Документ уйдёт в корзину'+(chk?'':', бланк станет <b>испорченным</b> (номер строгой отчётности не освобождается)')+'. Выписать заново можно сразу'+(chk?'':' — на новом бланке')+'.</div>'
    +'<label style="display:block;margin-top:var(--s-3)"><span class="sm">Причина</span><input id="twwr" autocomplete="off" style="width:100%" placeholder="например, ошибка в адресе"></label>', function(){
    run({vapi:'deldealdoc', deal:TWWBB.deal, type:type, id:id||'', reason:val('twwr')}, 'Отменяю…', 'twwbmsg').then(function(x){ if(x) twWbRefresh(); }); }, 'Отменить документ');
}
function twWbReserveDlg(k){
  var ru=k==='tn'?'ТН':'ТТН';
  get({vapi:'blanksfree', kind:ru, limit:40}).then(function(r){
    var bs=(r&&r.blanks)||[];
    if(!bs.length){ oops('Свободных бланков '+ru+' нет — загрузите новую пачку в «Накладные и документы»'); return; }
    ask('Зарезервировать бланк '+ru, '<div class="sm">Номер закрепится за этим заказом: другим не выдаётся, при выписке подставится сам. Резерв можно снять.</div>'
      +'<label style="display:block;margin-top:var(--s-3)"><span class="sm">Бланк</span><select id="twrb" style="width:100%">'
      +bs.map(function(b,i){ return '<option value="'+esc(b.num)+'">'+esc(b.label)+(i===0?' — следующий свободный':'')+'</option>'; }).join('')+'</select></label><div class="msg" id="twrm"></div>',
      function(){ run({vapi:'blankreserve', deal:TWWBB.deal, kind:ru, num:val('twrb')}, 'Резервирую бланк…', 'twrm').then(function(x){ if(!x) return; hide('askmodal'); twWbRefresh(); }); return false; }, 'Зарезервировать');
  }).catch(function(e){ oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twWbUnreserve(k){
  run({vapi:'blankunreserve', deal:TWWBB.deal, kind:k==='tn'?'ТН':'ТТН'}, 'Снимаю резерв…', 'twwbmsg').then(function(x){ if(x) twWbRefresh(); });
}
function twWbVal(id){ var e=el(id); return e?String(e.value||''):''; }
function twWbDlg(cls){ var d=el('askmodal').querySelector('.dlg'); if(d) d.className=cls; }
/* частичная отгрузка (16.10.2026): «Отгружаем» меняет места/массу пропорционально (пока их не ввели руками) и проверку по договору */
function twWbShip(i,v){ var it=TWWB.items[i]; it.ship=Math.max(0,Number(v)||0);
  if(!it.pm && it.qty0>0){ it.places=Math.round(it.places0/it.qty0*it.ship); it.mass=Math.round(it.mass0/it.qty0*it.ship*100)/100;
    var a=el('wbp'+i), b=el('wbm'+i); if(a) a.value=it.places; if(b) b.value=it.mass; }
  twWbSums(); }
/* newBlank=1 — ещё одна накладная (остаток после всех выписанных); 0 — переформировать единственную (её количество снова свободно) */
function twWbMode(nb, init){ TWWB.__newBlank=!!nb; var prev=(TWWB.prev||[])[0], ps={}; if(prev&&!nb) (prev.ship||[]).forEach(function(l){ ps[l.id]=Number(l.qty)||0; });
  (TWWB.items||[]).forEach(function(it,i){ var base=nb?it.shipped0:(prev?(prev.ship?Math.max(0,it.shipped0-(ps[it.id]||0)):Math.max(0,it.shipped0-it.qty0)):it.shipped0);
    it.shipped=base; var left=Math.max(0,it.qty0-base); it.ship=it.deal?0:((it.packed!=null)?Math.max(0,Math.min(left,Number(it.packed)-base)):left); it.left=left;
    var q=el('wbq'+i), sh=el('wbs'+i); if(q) q.value=it.ship; if(sh) sh.textContent=base;
    if(!it.pm){ it.places=(it.qty0>0&&it.ship!==it.qty0)?Math.round(it.places0/it.qty0*it.ship):it.places0; it.mass=(it.qty0>0&&it.ship!==it.qty0)?Math.round(it.mass0/it.qty0*it.ship*100)/100:it.mass0;
      var a=el('wbp'+i), b=el('wbm'+i); if(a) a.value=it.places; if(b) b.value=it.mass; } });
  twWbSums(); }
function twWbCheck(){ var c=TWWB&&TWWB.contractSum, box=el('wbcc'); if(!box) return; if(!c){ box.style.display='none'; return; }
  var cur=0; (TWWB.items||[]).forEach(function(it){ if(it.deal) return; cur+=(Number(it.ship)||0)*(Number(it.price)||0); }); cur=Math.round(cur*100)/100;
  var issued=TWWB.__newBlank?c.issued:Math.max(0,c.issued-((TWWB.prev||[])[0]?(TWWB.prev[0].sum||0):0)), diff=Math.round((issued+cur-c.amount)*100)/100;
  if(Math.abs(diff)<0.009 || !(cur>0)){ box.style.display='none'; return; }   // нечего отгружать — проверять нечего
  box.style.display=''; box.firstChild.innerHTML='⚠ Договор № '+esc(c.number)+' на '+twWbMoney(c.amount)+', а накладные в сумме дадут '+twWbMoney(issued+cur)
    +(issued?' (уже выписано '+twWbMoney(issued)+' + эта '+twWbMoney(cur)+')':'')+' — '+(diff>0?'больше':'меньше')+' на '+twWbMoney(Math.abs(diff))+'. Если это частичная отгрузка — так и задумано: остаток уйдёт следующей накладной. Иначе проверьте позиции и цены.'; }
function twWbSums(){ var pl=0,ms=0,zero=0,qs=0,pt=TWWB&&TWWB.__partial; ((TWWB&&TWWB.items)||[]).forEach(function(it,i){ qs+=Number(it.ship)||0; if(pt&&!(Number(it.ship)>0)) return; pl+=Number(it.places)||0; ms+=Number(it.mass)||0;
    var bad=!(Number(it.places)>0)||!(Number(it.mass)>0); if(bad) zero++;
    var r=el('wbr'+i); if(r){ var ins=r.getElementsByTagName('input'); for(var k=0;k<ins.length;k++){ var ok=Number(ins[k].value)>0; ins[k].style.borderColor=ok?'':'var(--red)'; ins[k].style.background=ok?'':'var(--red-bg)'; } } });
  var a=el('wbtp'), b=el('wbtm'), z=el('wbzero'), q=el('wbtq'); if(a) a.textContent=pl; if(b) b.textContent=Math.round(ms*100)/100; if(z) z.style.display=zero?'':'none'; if(q) q.textContent=qs; twWbCheck(); }
