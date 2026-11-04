/* Давальческое сырьё клиента (владелец 04.11.2026): договор на переработку → приём сырья по накладной клиента (ДС-N) → акт выполненных работ
   (отгрузочный документ сделки) → возврат продукции и остатка сырья нашей ТН/ТТН (ДВ-N, «Без НДС»). Отходы остаются у нас.
   Ждёт от страницы (как tw-tolling.js): get, run, ask, hide, info, el, esc, money, setm, val, oops, errText, netText; окно — #askmodal.
   Сервер: intakelist · intakesave · intakedelete · intakescan · intakeattach · tollingissue(direction=return) · tollinglist(deal) · actinfo · actrender. */
var TWIN={ box:'', q:{}, rows:[] }, TWRT=null;
function twInNum(n){ n=Number(n)||0; return String(Math.round(n*1000)/1000).replace('.',','); }
function twInToday(){ var d=new Date(Date.now()+3*3600e3), p=function(n){ return (n<10?'0':'')+n; }; return p(d.getUTCDate())+'.'+p(d.getUTCMonth()+1)+'.'+d.getUTCFullYear(); }
function twInDlg(cls){ var d=el('askmodal').querySelector('.dlg'); if(d) d.className=cls; }
var TWIN_L='display:block;margin-top:var(--s-2)', TWIN_SM='display:block;font:var(--t-small);color:var(--muted);margin-bottom:var(--s-1)';
function twInInp(id,label,v,ph,full){ return '<label style="'+TWIN_L+(full?';grid-column:1 / -1':'')+'"><span style="'+TWIN_SM+'">'+label+'</span><input id="'+id+'" value="'+esc(v||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off" style="width:100%"></label>'; }

/* ══════════ блок «Давальческое сырьё клиента» (карточка договора / клиента / сделки) ══════════ */
/* q: { contract, counterparty, deal } — что показывать; deal — возврат будет привязан к этой сделке */
function twIntakeBlock(boxId, q){
  var box=el(boxId); if(!box) return; TWIN={ box:boxId, q:q||{}, rows:[] }; box.innerHTML='<div class="sm muted">Загрузка…</div>';
  get({vapi:'intakelist', contract:q.contract||'', counterparty:q.counterparty||'', deal:q.deal||''}).then(function(r){
    if(!r||!r.ok){ box.innerHTML='<span class="err">⚠️ '+esc(errText(r))+'</span>'; return; }
    var rows=TWIN.rows=r.rows||[], open=rows.filter(function(x){ return x.status==='open'; });
    var head='<div class="row" style="margin-bottom:var(--s-2);align-items:center;flex-wrap:wrap;gap:var(--s-2)"><b>Давальческое сырьё клиента</b>'
      +(open.length?'<span class="pill warn">на руках '+open.length+' · '+money(r.leftSum)+' р.</span>':'<span class="pill muted">на руках ничего</span>')
      +'<span style="margin-left:auto;display:flex;gap:var(--s-2)"><button class="sm" onclick="twIntake()">＋ Принять сырьё по накладной клиента</button></span></div>';
    if(!rows.length){ box.innerHTML=head+'<div class="empty">Сырьё от клиента ещё не принимали. Когда клиент привезёт материал — внесите его накладную: строки, количество и стоимость (без НДС).</div>'; return; }
    box.innerHTML=head+'<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Приём</th><th>Накладная клиента</th><th>Сырьё: принято · израсходовано · возвращено · на руках</th><th>Возвраты</th><th></th></tr></thead><tbody>'
      +rows.map(function(x,i){
        var lines=(x.lines||[]).map(function(l){ return '<div><b>'+esc(l.name)+'</b><span class="muted"> — '+twInNum(l.qty)+' '+esc(l.unit)+(l.used?' · израсх. '+twInNum(l.used):'')+(l.returned?' · возвр. '+twInNum(l.returned):'')+'</span>'
          +' · на руках <b class="'+(l.left>0.0005?'':'muted')+'">'+twInNum(l.left)+' '+esc(l.unit)+'</b></div>'; }).join('');
        var rets=(x.returns||[]).map(function(t){ return t.url?'<a href="'+esc(t.url)+'" target="_blank" rel="noopener">'+esc(t.number)+'</a> '+esc(t.date):esc(t.number)+' '+esc(t.date); }).join('<br>');
        var act=(x.status==='open'?'<button onclick="twReturn('+i+')" title="выписать нашу ТН/ТТН: продукция + остаток сырья">↩ Возврат</button>':'')
          +(x.returns&&x.returns.length?'':'<button class="danger" onclick="twIntakeDel('+i+')" title="удалить ошибочный приём">✕</button>');
        return '<tr><td data-l="Приём" style="white-space:nowrap"><b>'+esc(x.number)+'</b><span class="sub2">'+(x.status==='open'?'<span class="pill warn">на руках</span>':'<span class="pill ok">закрыт</span>')+'</span></td>'
          +'<td data-l="Накладная">'+esc(x.docNo)+' от '+esc(x.date)+'<span class="sub2">'+money(x.amount)+' р. без НДС'+(x.files||[]).map(function(f,n){ return ' · <a href="'+esc(f.url)+'" target="_blank" rel="noopener" title="'+esc(f.name||'')+'">'+(n?'скан '+(n+1):'скан')+' ↗</a>'; }).join('')+(x.contract?' · договор '+esc(x.contract):'')+'</span></td>'
          +'<td data-l="Сырьё" class="sm">'+lines+'</td><td data-l="Возвраты" class="sm">'+(rets||'<span class="muted">—</span>')+'</td><td class="acts2">'+act+'</td></tr>'; }).join('')+'</tbody></table></div>';
  }).catch(function(e){ box.innerHTML='<span class="err">'+esc(netText(e))+'</span>'; });
}
function twIntakeRefresh(){ if(TWIN.box) twIntakeBlock(TWIN.box, TWIN.q); }
function twIntakeDel(i){ var x=TWIN.rows[i];
  ask('Удалить приём '+x.number+'?', '<div>Накладная клиента '+esc(x.docNo)+' от '+esc(x.date)+' будет снята из учёта давальческого сырья. Скан на Диске остаётся.</div>',
    function(){ run({vapi:'intakedelete', id:x.id}, 'Удаляю…').then(function(r){ if(r) twIntakeRefresh(); }); }, 'Удалить'); }

/* ══════════ окно «Принять сырьё по накладной клиента» ══════════ */
var TWINF=null;
function twIntake(){
  TWINF={ lines:[{ name:'', unit:'т', qty:'', price:'' }], files:[] };
  var body='<div class="note"><div>Сырьё остаётся собственностью клиента: в закупки и расходы оно не идёт. Загрузите скан или фото накладной клиента — номер, дата и строки заполнятся сами; проверьте и поправьте.</div></div>'
    +'<label style="'+TWIN_L+'"><span style="'+TWIN_SM+'">Сканы накладной клиента (PDF, фото) — можно сразу несколько: ТТН и приложение со строками</span><input type="file" id="infile" multiple accept="application/pdf,image/*" onchange="twInFile(this)"></label><div class="msg" id="inscan"></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 var(--s-3)">'+twInInp('inno','Накладная клиента: серия и номер бланка','','ДХ 3607039')+twInInp('indt','Дата накладной',twInToday(),'дд.мм.гггг')+'</div>'
    +'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm"><thead><tr><th>Наименование сырья</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена без НДС</th><th class="num">Сумма</th><th></th></tr></thead><tbody id="inrows"></tbody>'
    +'<tfoot><tr><td colspan="4" style="text-align:right;font-weight:600">Итого</td><td class="num" id="insum" style="font-weight:600">0,00</td><td></td></tr></tfoot></table></div>'
    +'<div class="row" style="margin-top:var(--s-2)"><button type="button" class="sm sec" onclick="twInAdd()">＋ Строка</button></div>'
    +twInInp('innote','Заметка (не печатается)','')+'<div class="msg" id="inm"></div>';
  ask('📥 Принять давальческое сырьё', body, function(){
    twInRead(); var lines=TWINF.lines.filter(function(l){ return l.name&&Number(String(l.qty).replace(',','.'))>0; });
    if(!val('inno').trim()){ setm('inm','err','Укажите номер накладной клиента'); return false; }
    if(!lines.length){ setm('inm','err','Добавьте хотя бы одну строку сырья с количеством'); return false; }
    var data={ contract:TWIN.q.contract||'', counterparty:TWIN.q.counterparty||'', docNo:val('inno').trim(), date:val('indt').trim(), note:val('innote').trim(), lines:lines };
    run({vapi:'intakesave', data:JSON.stringify(data)}, 'Сохраняю приём…', 'inm').then(function(r){ if(!r) return;
      var fs=TWINF.files.slice(), done=function(){ twInDlg('dlg'); hide('askmodal'); twIntakeRefresh(); };
      var next=function(){ var f=fs.shift(); if(!f) return done();   // сканы по одному: первый — основной (ТТН), остальные — списком
        run({vapi:'intakeattach', id:r.id, b64:f.b64, mime:f.mime, name:f.name}, 'Кладу скан на Диск: '+f.name+'…', 'inm').then(function(){ next(); }); };
      next();
    });
    return false;
  }, 'Принять сырьё');
  twInDlg('dlg lg'); el('askNo').onclick=function(){ hide('askmodal'); twInDlg('dlg'); };
  twInRender();
}
/* несколько файлов (ТТН + приложение): номер — из файла, где он есть; строки — из файла с настоящими строками (не «товар согласно приложению»);
   дата — самая поздняя из распознанных (рукописный год на бланке модель читает неуверенно) — проверить глазами */
function twInFile(inp){ var list=[].slice.call(inp.files||[]); if(!list.length) return;
  TWINF.files=[]; var got=[], k=0;
  var read=function(f){ return new Promise(function(ok){ var rd=new FileReader(); rd.onload=function(){ ok({ b64:String(rd.result).split(',')[1]||'', mime:f.type, name:f.name }); }; rd.readAsDataURL(f); }); };
  var step=function(){ if(k>=list.length) return twInMerge(got); var f=list[k++];
    setm('inscan','','Распознаю '+esc(f.name)+' ('+k+' из '+list.length+')…');
    read(f).then(function(x){ TWINF.files.push(x); return post({vapi:'intakescan', b64:x.b64, mime:x.mime, name:x.name}); })
      .then(function(r){ if(r&&r.ok) got.push(r); step(); }, function(){ step(); }); };
  step(); }
function twInMerge(rs){
  if(!rs.length){ setm('inscan','err','Не распознано — заполните вручную, сканы всё равно сохранятся.'); return; }
  var no='', dates=[], sup='', lines=null, pref=/согласно\s+приложени/i;
  rs.forEach(function(r){ if(!no&&r.docNo) no=r.docNo; if(r.date) dates.push(r.date); if(!sup&&r.supplier) sup=r.supplier;
    var real=(r.lines||[]).filter(function(l){ return !pref.test(l.name); }); if(real.length&&!lines) lines=real; });
  if(!lines) lines=(rs[0].lines||[]);
  var iso=function(d){ var m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d||''); return m?m[3]+m[2]+m[1]:''; };
  dates.sort(function(a,b){ return iso(b).localeCompare(iso(a)); });
  if(no) el('inno').value=no; if(dates[0]) el('indt').value=dates[0];
  if(lines.length) TWINF.lines=lines.map(function(l){ return { name:l.name, unit:l.unit||'шт', qty:l.qty, price:l.price }; });
  twInRender();
  var diff=dates.length>1&&dates[0]!==dates[dates.length-1];
  setm('inscan', diff?'warn':'ok', '✓ Распознано '+rs.length+' из '+TWINF.files.length+(sup?': '+esc(sup):'')+'. Проверьте номер, дату и строки.'+(diff?' Даты в файлах разные ('+esc(dates.join(', '))+') — поставлена более поздняя.':''));
}
function twInRead(){ TWINF.lines.forEach(function(l,i){ if(!el('inn'+i)) return; l.name=val('inn'+i).trim(); l.unit=val('inu'+i).trim()||'шт'; l.qty=val('inq'+i); l.price=val('inp'+i); }); }
function twInAdd(){ twInRead(); TWINF.lines.push({ name:'', unit:'шт', qty:'', price:'' }); twInRender(); }
function twInDel(i){ twInRead(); TWINF.lines.splice(i,1); twInRender(); }
function twInRender(){
  el('inrows').innerHTML=TWINF.lines.map(function(l,i){
    return '<tr><td><input id="inn'+i+'" value="'+esc(l.name)+'" placeholder="как в накладной клиента" style="width:100%;min-width:200px"></td>'
      +'<td><input id="inu'+i+'" value="'+esc(l.unit)+'" style="width:4em"></td>'
      +'<td class="num"><input id="inq'+i+'" type="number" step="0.001" min="0" value="'+esc(l.qty)+'" style="width:6em" oninput="twInSum()"></td>'
      +'<td class="num"><input id="inp'+i+'" type="number" step="0.01" min="0" value="'+esc(l.price)+'" style="width:7em" oninput="twInSum()"></td>'
      +'<td class="num" id="ins'+i+'">0,00</td><td><button type="button" class="sm sec" onclick="twInDel('+i+')" title="убрать строку">✕</button></td></tr>'; }).join('');
  twInSum();
}
function twInSum(){ var t=0; TWINF.lines.forEach(function(l,i){ if(!el('inq'+i)) return; var s=Math.round((Number(val('inq'+i))||0)*(Number(val('inp'+i))||0)*100)/100; t+=s; el('ins'+i).textContent=money(s); }); el('insum').textContent=money(t); }

/* ══════════ окно «Возврат продукции клиенту» (ДВ-N) ══════════ */
/* i — строка TWIN.rows (приём); dealId — сделка возврата (из карточки сделки), можно пусто */
function twReturn(i, dealId){
  var x=TWIN.rows[i]; if(!x) return;
  TWRT={ intake:x, deal:dealId||TWIN.q.deal||'', kind:'ТН', blanks:{}, prods:[{ name:'', unit:'шт', qty:'', price:'' }] };
  var raw='<table class="tbl sm"><thead><tr><th>Сырьё клиента</th><th class="num">На руках</th><th class="num" title="ушло в продукцию и отходы — в накладную не печатается">Израсходовано</th><th class="num" title="неиспользованное сырьё — строкой в накладной">Возвращаем остатком</th></tr></thead><tbody>'
    +(x.lines||[]).map(function(l,k){ return '<tr><td>'+esc(l.name)+'<span class="sub2">'+money(l.price)+' р./'+esc(l.unit)+'</span></td><td class="num">'+twInNum(l.left)+' '+esc(l.unit)+'</td>'
      +'<td class="num"><input id="rtu'+k+'" type="number" step="0.001" min="0" value="'+esc(l.left>0?twInNum(l.left).replace(',','.'):'')+'" style="width:6em" oninput="twRtCost()"></td>'
      +'<td class="num"><input id="rtr'+k+'" type="number" step="0.001" min="0" value="" style="width:6em" oninput="twRtCost()"></td></tr>'; }).join('')+'</tbody></table>';
  var body='<div class="note"><div>Наша накладная клиенту: <b>продукция</b> из его сырья и <b>остаток</b> сырья, «Без НДС». Стоимость продукции по умолчанию — стоимость израсходованного сырья (можно поправить). Отходы и обрезки остаются у нас и в накладную не идут.</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 var(--s-3)">'
    +'<label style="'+TWIN_L+'"><span style="'+TWIN_SM+'">Накладная</span><div class="seg" id="rtkseg"><button type="button" class="on" data-k="ТН" onclick="twRtKind(\'ТН\')">ТН</button><button type="button" data-k="ТТН" onclick="twRtKind(\'ТТН\')">ТТН</button></div></label>'
    +twInInp('rtd','📅 Дата накладной',twInToday(),'дд.мм.гггг')
    +'<label style="'+TWIN_L+'"><span style="'+TWIN_SM+'">🧾 Бланк</span><select id="rtbl" style="width:100%"><option value="">загрузка…</option></select></label>'
    +twInInp('rtbs','Основание отпуска (пусто — договор и накладная клиента)','','Возврат продукции из давальческого сырья по договору № … от …',true)
    +twInInp('rta','📍 Пункт разгрузки (для ТТН)','','адрес клиента',true)+'</div>'
    +'<div class="sect" style="margin-top:var(--s-3)">Сырьё по приёму '+esc(x.number)+' ('+esc(x.docNo)+' от '+esc(x.date)+')</div><div class="tbl-wrap">'+raw+'</div>'
    +'<div class="sect" style="margin-top:var(--s-3)">Продукция из сырья клиента</div>'
    +'<div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма</th><th></th></tr></thead><tbody id="rtrows"></tbody></table></div>'
    +'<div class="row" style="margin-top:var(--s-2);gap:var(--s-2)"><button type="button" class="sm sec" onclick="twRtAdd()">＋ Продукция</button><button type="button" class="sm sec" onclick="twRtSpread()" title="цена продукции = стоимость израсходованного сырья ÷ количество">⇄ Стоимость сырья → цена продукции</button><span class="sm muted" id="rtcost"></span></div>'
    +'<details id="rttrans" style="margin-top:var(--s-3)"><summary class="sm">🚚 Перевозка (ТТН)</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 var(--s-3)">'
    +twInInp('rtfr','Заказчик перевозки','Мы','Мы / Клиент')+twInInp('rtdr','Водитель','')+twInInp('rtcar','Автомобиль','')+twInInp('rtrc','Принял (должность, Ф.И.О.)','')+twInInp('rtpx','Доверенность (номер, дата)','')+'</div></details>'
    +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="rtc"> Я проверил <b>дату</b>, <b>продукцию</b> и <b>остаток</b></label><div class="msg" id="rtm"></div>';
  ask('↩ Возврат продукции клиенту', body, function(){
    twRtRead();
    var lines=[], used=false;
    (x.lines||[]).forEach(function(l,k){ var u=Number(val('rtu'+k))||0, b=Number(val('rtr'+k))||0;
      if(u>0){ used=true; lines.push({ kind:'used', srcLine:k, name:l.name, unit:l.unit, qty:u, price:0 }); }
      if(b>0) lines.push({ kind:'text', srcLine:k, name:l.name+' (остаток давальческого сырья)', unit:l.unit, qty:b, price:l.price }); });
    TWRT.prods.forEach(function(p){ if(p.name&&Number(p.qty)>0) lines.unshift({ kind:'text', name:p.name, unit:p.unit||'шт', qty:Number(p.qty), price:Number(p.price)||0 }); });
    if(!lines.some(function(l){ return l.kind!=='used'; })){ setm('rtm','err','Добавьте продукцию или остаток сырья'); return false; }
    if(TWRT.kind==='ТТН'&&!val('rta').trim()){ setm('rtm','err','Для ТТН укажите пункт разгрузки'); return false; }
    if(!el('rtc').checked){ setm('rtm','err','Отметьте, что проверили дату, продукцию и остаток'); return false; }
    var data={ direction:'return', intakeId:x.id, dealId:TWRT.deal, kind:TWRT.kind, date:val('rtd').trim(), basis:val('rtbs').trim(), address:val('rta').trim(), blankId:val('rtbl'), lines:lines,
      transport:{ freight:val('rtfr').trim(), driver:val('rtdr').trim(), car:val('rtcar').trim(), recipient:val('rtrc').trim(), proxy:val('rtpx').trim() } };
    run({vapi:'tollingissue', data:JSON.stringify(data)}, 'Формирую накладную…', 'rtm').then(function(r){ if(!r) return;
      twInDlg('dlg'); hide('askmodal');
      info('Накладная сформирована', '<div>✅ '+esc(r.number)+' · '+esc(TWRT.kind)+(r.waybill?' · бланк <b>'+esc(r.waybill)+'</b>':'')+' на '+money(r.amount)+' р.: <a href="'+esc(r.url)+'" target="_blank" rel="noopener">открыть</a></div>'
        +'<div class="sm" style="margin-top:var(--s-2)">Подписанный скан загружается в реестре накладных. Работы закрывает акт выполненных работ в сделке.</div>');
      twIntakeRefresh(); if(window.twActRefresh) twActRefresh();
    });
    return false;
  }, 'Сформировать накладную');
  twInDlg('dlg lg'); el('askNo').onclick=function(){ hide('askmodal'); twInDlg('dlg'); };
  twRtKind('ТН'); twRtRender(); twRtCost();
}
function twRtKind(k){ TWRT.kind=k; var bs=el('rtkseg').querySelectorAll('button'); for(var i=0;i<bs.length;i++) bs[i].className=bs[i].getAttribute('data-k')===k?'on':''; el('rttrans').open=(k==='ТТН');
  if(!TWRT.blanks[k]){ el('rtbl').innerHTML='<option value="">загрузка…</option>';
    get({vapi:'blanksfree', kind:k}).then(function(r){ TWRT.blanks[k]=(r&&r.blanks)||[]; if(TWRT.kind===k) twRtBlanks(); }).catch(function(){ TWRT.blanks[k]=[]; twRtBlanks(); }); }
  else twRtBlanks(); }
function twRtBlanks(){ var bs=TWRT.blanks[TWRT.kind]||[]; el('rtbl').innerHTML=bs.length?bs.map(function(b,i){ return '<option value="'+esc(b.id)+'"'+(i===0?' selected':'')+'>'+esc(b.label)+(i===0?' — следующий свободный':'')+'</option>'; }).join(''):'<option value="">свободных бланков '+esc(TWRT.kind)+' нет</option>'; }
function twRtRead(){ TWRT.prods.forEach(function(p,i){ if(!el('rpn'+i)) return; p.name=val('rpn'+i).trim(); p.unit=val('rpu'+i).trim()||'шт'; p.qty=val('rpq'+i); p.price=val('rpp'+i); }); }
function twRtAdd(){ twRtRead(); TWRT.prods.push({ name:'', unit:'шт', qty:'', price:'' }); twRtRender(); }
function twRtDel(i){ twRtRead(); TWRT.prods.splice(i,1); twRtRender(); }
function twRtRender(){
  el('rtrows').innerHTML=TWRT.prods.map(function(p,i){
    return '<tr><td><input id="rpn'+i+'" value="'+esc(p.name)+'" placeholder="например, Накладка (из давальческой ленты)" style="width:100%;min-width:200px"></td>'
      +'<td><input id="rpu'+i+'" value="'+esc(p.unit)+'" style="width:4em"></td>'
      +'<td class="num"><input id="rpq'+i+'" type="number" step="0.001" min="0" value="'+esc(p.qty)+'" style="width:6em" oninput="twRtSum()"></td>'
      +'<td class="num"><input id="rpp'+i+'" type="number" step="0.01" min="0" value="'+esc(p.price)+'" style="width:7em" oninput="twRtSum()"></td>'
      +'<td class="num" id="rps'+i+'">0,00</td><td><button type="button" class="sm sec" onclick="twRtDel('+i+')" title="убрать строку">✕</button></td></tr>'; }).join('');
  twRtSum();
}
function twRtSum(){ TWRT.prods.forEach(function(p,i){ if(!el('rpq'+i)) return; el('rps'+i).textContent=money(Math.round((Number(val('rpq'+i))||0)*(Number(val('rpp'+i))||0)*100)/100); }); }
/* стоимость израсходованного сырья: Σ израсходовано × цена строки приёма */
function twRtUsedCost(){ var t=0; (TWRT.intake.lines||[]).forEach(function(l,k){ t+=(Number(val('rtu'+k))||0)*(Number(l.price)||0); }); return Math.round(t*100)/100; }
function twRtCost(){ var c=twRtUsedCost(); if(el('rtcost')) el('rtcost').textContent=c?'израсходовано сырья на '+money(c)+' р.':''; }
function twRtSpread(){ twRtRead(); var c=twRtUsedCost(), ps=TWRT.prods.filter(function(p){ return p.name&&Number(p.qty)>0; }), q=0; ps.forEach(function(p){ q+=Number(p.qty); });
  if(!c||!q){ setm('rtm','err','Укажите израсходованное сырьё и количество продукции'); return; }
  var unit=Math.round(c/q*100)/100; ps.forEach(function(p){ p.price=unit; }); twRtRender(); setm('rtm','','Цена продукции: '+money(c)+' ÷ '+twInNum(q)+' = '+money(unit)+' р.'); }

/* ══════════ блок «Акт выполненных работ» в карточке сделки (договор переработки) ══════════ */
var TWACT={ box:'', deal:'', info:null };
function twActBlock(boxId, dealKey){
  var box=el(boxId); if(!box) return; TWACT={ box:boxId, deal:dealKey, info:null };
  get({vapi:'actinfo', deal:dealKey}).then(function(r){
    if(!r||!r.ok){ box.innerHTML='<span class="err">⚠️ '+esc(errText(r))+'</span>'; return; }
    if(!r.processing){ box.innerHTML=''; box.style.display='none'; return; }
    box.style.display=''; TWACT.info=r;
    if(el('s_ship')) el('s_ship').style.display='none';   // отгрузка по договору переработки — акт; наш товар накладной не отгружается
    var acts=(r.acts||[]).map(function(a){ return twFileCard({ href:a.url, tab:1, tag:'АКТ', title:'Акт выполненных работ № '+a.number, meta:[a.date, money(a.sum)+' руб.'].join(' · '),
      pills:a.status!=='formed'?'<span class="pill muted">'+esc(a.status)+'</span>':'' }); }).join('');
    box.innerHTML='<div class="row" style="align-items:center;gap:var(--s-2);flex-wrap:wrap"><b>📝 Давальческая переработка</b><span class="sm muted">договор № '+esc(r.contract.number)+' от '+esc(r.contract.date)+'</span>'
      +'<span style="margin-left:auto;display:flex;gap:var(--s-2)"><button class="sm" onclick="twAct()">'+(acts?'Переформировать акт':'Сформировать акт')+'</button></span></div>'
      +'<div class="sm muted" style="margin:var(--s-1) 0 var(--s-2)">Акт — отгрузочный документ: заказ становится «отгружено», долг клиента по договору — сумма акта. Продукцию и остаток сырья возвращаем накладной ниже.</div>'
      +(acts||'<div class="sm muted">Актов ещё нет.</div>')
      +'<div id="actIntake" style="margin-top:var(--s-3)"></div>';
    twIntakeBlock('actIntake', { deal:dealKey, contract:r.contract.id });   // приём сырья отсюда — к договору переработки сделки
  }).catch(function(e){ box.innerHTML='<span class="err">'+esc(netText(e))+'</span>'; });
}
function twActRefresh(){ if(TWACT.box) twActBlock(TWACT.box, TWACT.deal); }
function twAct(){
  var r=TWACT.info; if(!r) return;
  var body='<div class="note"><div>Позиции работ сделки: укажите, сколько выполнено. НДС — по ставке на дату акта. Номер акта — по клиенту с 1; переформирование сохраняет номер.</div></div>'
    +twInInp('acd','Дата акта',twInToday(),'дд.мм.гггг')
    +'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm"><thead><tr><th>Работа</th><th class="num">В заказе</th><th class="num">Выполнено</th><th class="num">Цена с НДС</th></tr></thead><tbody>'
    +(r.items||[]).map(function(it,i){ return '<tr><td>'+esc(it.name)+'</td><td class="num">'+twInNum(it.qty)+' '+esc(it.unit)+'</td><td class="num"><input id="acq'+i+'" type="number" step="0.001" min="0" value="'+esc(it.qty)+'" style="width:6em"></td><td class="num">'+money(it.price)+'</td></tr>'; }).join('')
    +'</tbody></table></div><div class="msg" id="acm"></div>';
  ask('📝 Акт выполненных работ', body, function(){
    var ship=(r.items||[]).map(function(it,i){ return { id:it.id, qty:Number(val('acq'+i))||0 }; });
    if(!ship.some(function(s){ return s.qty>0; })){ setm('acm','err','Укажите выполненное количество'); return false; }
    run({vapi:'actrender', deal:TWACT.deal, date:val('acd').trim(), ship:JSON.stringify(ship)}, 'Формирую акт…', 'acm').then(function(x){ if(!x) return;
      hide('askmodal'); info('Акт сформирован', '<div>✅ Акт № '+esc(x.number)+' от '+esc(x.date)+': <a href="'+esc(x.url)+'" target="_blank" rel="noopener">открыть</a></div>'
        +(x.hint?'<div class="sm" style="margin-top:var(--s-2)">'+esc(x.hint)+'</div>':x.shipped?'<div class="sm" style="margin-top:var(--s-2)">Заказ отмечен «отгружено».</div>':''));
      twActRefresh(); });
    return false;
  }, 'Сформировать акт');
}
