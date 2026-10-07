/* Диалог накладной ТН/ТТН (бриф 30.09.2026): один на карточку сделки (sales.html), карточку договора (contract.html) и реестр (salesdocs.html).
   wbprep(deal, kind) → дата отгрузки (= дата накладной; по умолчанию правка накладной / дата забора / дата доставки), адрес доставки
   (правка / «Адрес доставки ЮЛ» / адрес сделки), заказчик перевозки (договор → amoCRM → «Мы»), водитель, автомобиль, прицеп, путевой лист,
   места/масса по позициям → wbissue(deal, kind, data) сохраняет всё у сделки (waybill.ts saveWaybillData) и формирует документ.
   Ждёт от страницы: get, run, ask, hide, info, oops, errText, el, val, esc, setm, money. twWaybill(dealKey, 'ТН'|'ТТН'|'ТТН Юрлицо'|'Товарный чек', onDone).
   07.10.2026: бланк — резерв сделки / следующий свободный / выбрать; ТН и товарный чек — только дата (перевозку и места печатает лишь ТТН);
   twWaybillBlock(dealKey, box, onDone) — блок «Накладные» карточек сделки и договора: что выписывать по договору, резерв бланка,
   накладные карточками со статусом «выписана / подписана» и загрузкой подписанного скана, «выписано · оплачено ЕРИП · закрыта». */
var TWWB=null;
function twWaybill(dealKey, kind, onDone){
  get({vapi:'wbprep', deal:dealKey, kind:kind}).then(function(p){
    if(!p||!p.ok){ oops(errText(p)); return; }
    TWWB=p; TWWB.__kind=kind; TWWB.__deal=dealKey;
    var items=p.items||[];
    var miss=(p.missing&&p.missing.length)?('<div class="note warn"><div>⚠ Не хватает для накладной: '+esc(p.missing.join(', '))+'</div></div>'):'';
    var rows=items.map(function(it,i){
      return '<tr><td data-l="Наименование">'+esc(it.name)+'</td><td data-l="Кол-во" class="num">'+esc(it.qty)+'</td>'
        +'<td data-l="Мест"><input type="number" min="0" value="'+esc(it.places)+'" oninput="TWWB.items['+i+'].places=this.value;twWbSums()" autocomplete="off"></td>'
        +'<td data-l="Масса, кг"><input type="number" min="0" step="0.01" value="'+esc(it.mass)+'" oninput="TWWB.items['+i+'].mass=this.value;twWbSums()" autocomplete="off"></td></tr>';
    }).join('');
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
      +(tn
        ?'<details style="margin-top:var(--s-3)"><summary class="sm">🚚 Перевозка и доверенность — если нужно заполнить в накладной</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+proxy+trans+'</div></details>'
        :'<div class="sm" style="margin-top:var(--s-3);font-weight:600">🚚 Перевозка</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+trans+'</div>'
          +'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm mob wbt"><thead><tr><th>Наименование</th><th class="num">Кол-во</th><th>Мест</th><th>Масса, кг</th></tr></thead>'
          +'<tbody>'+rows+'<tr style="font-weight:600"><td>Итого</td><td></td><td data-l="Мест" id="wbtp">0</td><td data-l="Масса, кг" id="wbtm">0</td></tr></tbody></table></div>')
      +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="wbc"> Я проверил <b>дату</b>'+(tn?'':' и <b>адрес</b>')+'</label>'
      +'<div class="msg" id="wbm"></div>';
    ask('✍️ Выписать '+esc(p.title||kind), body, function(){
      var date=val('wbd').trim(), addr=el('wba')?val('wba').trim():undefined;
      if(!date){ setm('wbm','err','Укажите дату накладной'); return false; }
      if(!el('wbc').checked){ setm('wbm','err','Отметьте, что проверили дату'+(tn?'':' и адрес')); return false; }
      var payload={ date:date, freight:val('wbf'), driver:val('wbdr').trim(), car:val('wbcar').trim(), trailer:val('wbtr').trim(), waybillDoc:val('wbpl').trim(),
        recipient:twWbVal('wbrc').trim(), proxy:twWbVal('wbpx').trim(), proxyBy:twWbVal('wbpb').trim(), blankId:(el('wbbl')&&el('wbbl').value)||'' };
      if(addr!==undefined) payload.address=addr;
      if(!tn) payload.items=(TWWB.items||[]).map(function(it){ return {places:Number(it.places)||0, mass:Number(it.mass)||0}; });
      twWbSend(dealKey, kind, payload, onDone);
      return false;   // окно закроем после ответа сервера
    }, 'Сформировать накладную');
    twWbDlg('dlg md');
    el('askNo').onclick=function(){ hide('askmodal'); twWbDlg('dlg'); };
    twWbSums();
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
    var acts=bad?'':d.signedAt?('<a href="'+esc(d.signedUrl)+'" target="_blank" rel="noopener">скан ↗</a><a href="#" onclick="twWbUnsign(\''+esc(d.id)+'\');return false;">убрать скан</a>')
      :'<button class="sec sm" onclick="twWbSignDlg(\''+esc(d.id)+'\')">⬆ Подписанный скан</button>';
    return twFileCard({ href:d.url, tab:1, tag:chk?'ЧЕК':d.type, title:ttl+' '+(d.blank||''), meta:[d.date, twWbMoney(d.sum)+' '+(d.currency||'BYN'), d.error].filter(Boolean).join(' · '),
      pills:pills, acts:acts, del:"twWbCancel('"+(d.cancelType||ttl)+"')", delTitle:'Отменить '+(chk?'чек':'накладную') });
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
function twWbCancel(type){
  var chk=type==='Товарный чек';
  ask('Отменить '+(chk?'товарный чек':type)+'?', '<div>Документ уйдёт в корзину'+(chk?'':', бланк станет <b>испорченным</b> (номер строгой отчётности не освобождается)')+'. Выписать заново можно сразу'+(chk?'':' — на новом бланке')+'.</div>'
    +'<label style="display:block;margin-top:var(--s-3)"><span class="sm">Причина</span><input id="twwr" autocomplete="off" style="width:100%" placeholder="например, ошибка в адресе"></label>', function(){
    run({vapi:'deldealdoc', deal:TWWBB.deal, type:type, reason:val('twwr')}, 'Отменяю…', 'twwbmsg').then(function(x){ if(x) twWbRefresh(); }); }, 'Отменить документ');
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
function twWbSums(){ var pl=0,ms=0; ((TWWB&&TWWB.items)||[]).forEach(function(it){ pl+=Number(it.places)||0; ms+=Number(it.mass)||0; });
  var a=el('wbtp'), b=el('wbtm'); if(a) a.textContent=pl; if(b) b.textContent=Math.round(ms*100)/100; }
