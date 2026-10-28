/* Давальческая передача (владелец 28.10.2026): материалы или детали уезжают переработчику (Легендабай — шлифовка) по ТН / ТТН без сделки.
   Цена — закупочная с НДС (последняя закупка за нашу единицу), в накладной «Без НДС»; фанеру покупаем кубами, храним листами, отдаём в м² —
   единица накладной выбирается в строке, количество и цена пересчитываются по площади листа (area) или объёму (vol) из справочника.
   Ждёт от страницы: get, run, ask, hide, info, el, esc, money, setm, val, oops, errText, netText; окно — #askmodal (как tw-waybill.js).
   Сервер: tollingrefs · tollinglist(counterparty, status) · tollingissue(data) · tollingreturn(id, date, note) · tollingunreturn(id) · tollingcancel(id, reason). */
var TWTL=null, TWTLB={};
function twTlDlg(cls){ var d=el('askmodal').querySelector('.dlg'); if(d) d.className=cls; }
function twTlToday(){ var d=new Date(Date.now()+3*3600e3), p=function(n){ return (n<10?'0':'')+n; }; return p(d.getUTCDate())+'.'+p(d.getUTCMonth()+1)+'.'+d.getUTCFullYear(); }
function twTlNum(n){ n=Number(n)||0; return String(Math.round(n*1000)/1000).replace('.',','); }
/* окно «Передать на переработку» */
function twTolling(onDone, presetCp){
  get({vapi:'tollingrefs'}).then(function(p){
    if(!p||!p.ok){ oops(errText(p)); return; }
    TWTL={ refs:p, kind:'ТН', lines:[], blanks:{}, done:onDone };
    var L='display:block;margin-top:var(--s-2)', SM='display:block;font:var(--t-small);color:var(--muted);margin-bottom:var(--s-1)';
    var inp=function(id,label,v,ph,full){ return '<label style="'+L+(full?';grid-column:1 / -1':'')+'"><span style="'+SM+'">'+label+'</span><input id="'+id+'" value="'+esc(v||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off" style="width:100%"></label>'; };
    var cps=p.contractors||[], cp0=presetCp?cps.filter(function(c){ return c.id===presetCp; })[0]:null;
    var cpSel='<label style="'+L+'"><span style="'+SM+'">Переработчик (грузополучатель)</span><select id="tlcp" style="width:100%" onchange="twTlCp()"><option value="">— выберите —</option>'
      +['sub','sup'].map(function(g){ var list=cps.filter(function(c){ return g==='sub'?c.sub:!c.sub; }); return list.length?'<optgroup label="'+(g==='sub'?'Подрядчики':'Поставщики')+'">'+list.map(function(c){ return '<option value="'+esc(c.id)+'"'+(cp0&&c.id===cp0.id?' selected':'')+'>'+esc(c.name)+(c.unp?' · УНП '+esc(c.unp):'')+'</option>'; }).join('')+'</optgroup>':''; }).join('')+'</select></label>';
    var kindSel='<label style="'+L+'"><span style="'+SM+'">Накладная</span><div class="seg" id="tlkseg"><button type="button" class="on" data-k="ТН" onclick="twTlKind(\'ТН\')">ТН</button><button type="button" data-k="ТТН" onclick="twTlKind(\'ТТН\')">ТТН</button></div></label>';
    var trans=inp('tlfr','Заказчик перевозки','Мы','Мы / Клиент')+inp('tldr','Водитель (фамилия, инициалы)','')+inp('tlcar','Автомобиль (марка, гос. номер)','')+inp('tltr','Прицеп','')+inp('tlpl','Путевой лист №','')
      +inp('tlrc','Товар к доставке принял (должность, Ф.И.О.)','')+inp('tlpx','Доверенность (номер, дата)','','например, № 23 от 11.05.2026')+inp('tlpb','Доверенность выдана (организация)','');
    var body='<div class="note"><div>Материал остаётся нашим: передаём на обработку, переработчик вернёт его своей накладной. Цена — закупочная с НДС, в накладной печатается «Без НДС».</div></div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+cpSel+kindSel
      +inp('tld','📅 Дата накладной — проверьте!', twTlToday(), 'дд.мм.гггг')
      +'<label style="'+L+'"><span style="'+SM+'">🧾 Бланк (номер на бумаге)</span><select id="tlbl" style="width:100%"><option value="">загрузка…</option></select></label>'
      +inp('tlbs','Основание отпуска — договор с переработчиком', cp0?cp0.basis:'', 'Договор оказания услуг № 1/ТВ от 02.10.2026 г.', true)
      +inp('tla','📍 Пункт разгрузки (адрес переработчика)', cp0?cp0.delivery:'', 'адрес склада переработчика', true)
      +'</div>'
      +'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm tlt"><thead><tr><th>Что</th><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена с НДС</th><th class="num">Сумма</th><th class="tlttn">Мест</th><th class="tlttn">Масса, кг</th><th></th></tr></thead><tbody id="tlrows"></tbody>'
      +'<tfoot><tr><td colspan="5" style="text-align:right;font-weight:600">Итого</td><td class="num" id="tlsum" style="font-weight:600">0,00</td><td class="tlttn" id="tlpl2"></td><td class="tlttn" id="tlms2"></td><td></td></tr></tfoot></table></div>'
      +'<div class="row" style="margin-top:var(--s-2)"><button type="button" class="sm sec" onclick="twTlAdd(\'material\')">＋ Материал</button><button type="button" class="sm sec" onclick="twTlAdd(\'detail\')">＋ Деталь</button><button type="button" class="sm sec" onclick="twTlAdd(\'text\')">＋ Другое (от руки)</button></div>'
      +'<datalist id="tlmats">'+(p.materials||[]).map(function(m){ return '<option value="'+esc(m.name)+'">'+(m.price?money(m.price)+' р./'+esc(m.unit):esc(m.unit))+'</option>'; }).join('')+'</datalist>'
      +'<datalist id="tldets">'+(p.details||[]).map(function(d){ return '<option value="'+esc(d.name)+'">'+esc(d.equip||'')+'</option>'; }).join('')+'</datalist>'
      +'<details id="tltrans" style="margin-top:var(--s-3)"><summary class="sm">🚚 Перевозка и доверенность</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'+trans+'</div></details>'
      +inp('tlnote','Заметка (не печатается)','')
      +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="tlc"> Я проверил <b>дату</b>, <b>основание</b> и <b>позиции</b></label><div class="msg" id="tlm"></div>';
    ask('📦 Передать на переработку', body, function(){
      var cp=val('tlcp'), date=val('tld').trim(), basis=val('tlbs').trim();
      if(!cp){ setm('tlm','err','Выберите переработчика'); return false; }
      if(!date){ setm('tlm','err','Укажите дату накладной'); return false; }
      if(!basis){ setm('tlm','err','Укажите основание — договор с переработчиком'); return false; }
      twTlRead();
      var lines=TWTL.lines.filter(function(l){ return l.name&&Number(l.qty)>0; });
      if(!lines.length){ setm('tlm','err','Добавьте хотя бы одну позицию с количеством'); return false; }
      if(TWTL.kind==='ТТН'&&!val('tla').trim()){ setm('tlm','err','Для ТТН укажите пункт разгрузки'); return false; }
      if(!el('tlc').checked){ setm('tlm','err','Отметьте, что проверили дату, основание и позиции'); return false; }
      var data={ counterparty:cp, kind:TWTL.kind, date:date, basis:basis, address:val('tla').trim(), blankId:val('tlbl'), note:val('tlnote').trim(), lines:lines,
        transport:{ freight:val('tlfr').trim(), driver:val('tldr').trim(), car:val('tlcar').trim(), trailer:val('tltr').trim(), waybillDoc:val('tlpl').trim(), recipient:val('tlrc').trim(), proxy:val('tlpx').trim(), proxyBy:val('tlpb').trim() } };
      run({vapi:'tollingissue', data:JSON.stringify(data)}, 'Формирую накладную…', 'tlm').then(function(r){ if(!r) return;
        twTlDlg('dlg'); hide('askmodal');
        info('Накладная сформирована', '<div>✅ '+esc(r.number)+' · '+esc(TWTL.kind)+(r.waybill?' · бланк <b>'+esc(r.waybill)+'</b>':'')+' на '+money(r.amount)+' р.: <a href="'+esc(r.url)+'" target="_blank" rel="noopener">открыть</a></div>'
          +'<div class="sm" style="margin-top:var(--s-2)">Когда переработчик вернёт материал — отметьте «вернулось» в списке передач. Подписанный скан загружается в реестре накладных.</div>');
        if(TWTL.done) TWTL.done(r);
      });
      return false;
    }, 'Сформировать накладную');
    twTlDlg('dlg lg');
    el('askNo').onclick=function(){ hide('askmodal'); twTlDlg('dlg'); };
    twTlKind('ТН'); twTlAdd('material');
  }).catch(function(e){ oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twTlCp(){ var c=(TWTL.refs.contractors||[]).filter(function(x){ return x.id===val('tlcp'); })[0]; if(!c) return;
  if(!val('tlbs').trim()||TWTL.__bsAuto) { el('tlbs').value=c.basis||''; TWTL.__bsAuto=!!c.basis; }
  el('tla').value=c.delivery||''; }
function twTlKind(k){ TWTL.kind=k; var bs=el('tlkseg').querySelectorAll('button'); for(var i=0;i<bs.length;i++) bs[i].className=bs[i].getAttribute('data-k')===k?'on':'';
  var ttn=(k==='ТТН'); el('tltrans').open=ttn; var cs=document.querySelectorAll('.tlttn'); for(var j=0;j<cs.length;j++) cs[j].style.display=ttn?'':'none';
  if(!TWTL.blanks[k]){ el('tlbl').innerHTML='<option value="">загрузка…</option>';
    get({vapi:'blanksfree', kind:k}).then(function(r){ TWTL.blanks[k]=(r&&r.blanks)||[]; if(TWTL.kind===k) twTlBlanks(); }).catch(function(){ TWTL.blanks[k]=[]; twTlBlanks(); });
  } else twTlBlanks(); }
function twTlBlanks(){ var bs=TWTL.blanks[TWTL.kind]||[]; el('tlbl').innerHTML=bs.length?bs.map(function(b,i){ return '<option value="'+esc(b.id)+'"'+(i===0?' selected':'')+'>'+esc(b.label)+(i===0?' — следующий свободный':'')+'</option>'; }).join(''):'<option value="">свободных бланков '+esc(TWTL.kind)+' нет</option>'; }
/* строки: материал — из справочника (цена за нашу единицу, площадь листа), деталь — имя из справочника, цена от руки; «другое» — всё от руки */
function twTlAdd(kind){ twTlRead(); TWTL.lines.push({ kind:kind, name:'', unit:kind==='material'?'лист':'шт', qty:'', price:'', srcQty:'', places:'', mass:'' }); twTlRender(); }
function twTlDel(i){ twTlRead(); TWTL.lines.splice(i,1); twTlRender(); }
function twTlMat(name){ return (TWTL.refs.materials||[]).filter(function(m){ return m.name===name; })[0]||null; }
function twTlRender(){   // строки уже прочитаны вызывающим (twTlRead) — иначе подстановка цены/единицы затёрлась бы пустыми полями
  var units=TWTL.refs.units||['шт'], ttn=TWTL.kind==='ТТН';
  el('tlrows').innerHTML=TWTL.lines.map(function(l,i){
    var ul=units.slice(); if(l.unit&&ul.indexOf(l.unit)<0) ul.unshift(l.unit);
    var m=l.kind==='material'?twTlMat(l.name):null, conv=m&&l.unit!==m.unit&&((l.unit==='м²'&&m.area)||(l.unit==='м³'&&m.vol));
    var kindTxt={material:'материал',detail:'деталь',text:'другое'}[l.kind];
    return '<tr><td class="sm muted">'+kindTxt+'</td>'
      +'<td><input id="tln'+i+'" value="'+esc(l.name)+'"'+(l.kind==='material'?' list="tlmats"':l.kind==='detail'?' list="tldets"':'')+' placeholder="'+(l.kind==='material'?'материал из справочника':l.kind==='detail'?'деталь':'что передаём')+'" style="width:100%;min-width:180px" onchange="twTlName('+i+')" autocomplete="off">'
      +(m?'<div class="sm muted">'+(m.price?money(m.price)+' р./'+esc(m.unit):'цены закупки нет')+(m.area?' · лист '+twTlNum(m.area)+' м²':'')+'</div>':'')+'</td>'
      +'<td><select id="tlu'+i+'" onchange="twTlUnit('+i+')">'+ul.map(function(u){ return '<option'+(u===l.unit?' selected':'')+'>'+esc(u)+'</option>'; }).join('')+'</select></td>'
      +'<td class="num"><input type="number" step="0.001" min="0" id="tlq'+i+'" value="'+esc(l.qty)+'" style="width:6em" oninput="twTlSum()">'
      +(conv?'<div class="sm" style="white-space:nowrap">= <input type="number" step="1" min="0" id="tls'+i+'" value="'+esc(l.srcQty)+'" style="width:4.5em" oninput="twTlSrc('+i+')" title="сколько листов отдаём — м² посчитаются сами"> '+esc(m.unit)+'</div>':'')+'</td>'
      +'<td class="num"><input type="number" step="0.0001" min="0" id="tlp'+i+'" value="'+esc(l.price)+'" style="width:6.5em" oninput="twTlSum()"></td>'
      +'<td class="num" id="tlsm'+i+'">0,00</td>'
      +'<td class="tlttn"'+(ttn?'':' style="display:none"')+'><input type="number" min="0" id="tlpc'+i+'" value="'+esc(l.places)+'" style="width:4em" oninput="twTlSum()"></td>'
      +'<td class="tlttn"'+(ttn?'':' style="display:none"')+'><input type="number" min="0" step="0.01" id="tlms'+i+'" value="'+esc(l.mass)+'" style="width:5em" oninput="twTlSum()"></td>'
      +'<td><button type="button" class="sm sec" onclick="twTlDel('+i+')" title="убрать строку">✕</button></td></tr>';
  }).join('');
  twTlSum();
}
function twTlRead(){ TWTL.lines.forEach(function(l,i){ if(!el('tln'+i)) return; l.name=val('tln'+i).trim(); l.unit=val('tlu'+i); l.qty=val('tlq'+i); l.price=val('tlp'+i); l.srcQty=el('tls'+i)?val('tls'+i):''; l.places=el('tlpc'+i)?val('tlpc'+i):''; l.mass=el('tlms'+i)?val('tlms'+i):'';
  var m=l.kind==='material'?twTlMat(l.name):null; l.refId=m?m.id:''; if(l.srcQty) l.srcUnit=m?m.unit:''; }); }
/* выбрали материал: единица и цена — из справочника; единица изменилась: цена пересчитывается через площадь / объём листа */
function twTlName(i){ twTlRead(); var l=TWTL.lines[i], m=l.kind==='material'?twTlMat(l.name):null; if(m){ l.unit=m.unit; l.price=m.price||''; l.srcQty=''; } twTlRender(); }
function twTlFactor(m,u){ if(!m||u===m.unit) return 1; if(u==='м²'&&m.area) return m.area; if(u==='м³'&&m.vol) return m.vol; return 0; }
function twTlUnit(i){ twTlRead(); var l=TWTL.lines[i], m=l.kind==='material'?twTlMat(l.name):null, f=twTlFactor(m,l.unit);
  if(m&&m.price&&f) l.price=Math.round(m.price/f*10000)/10000;   // цена за м² = цена листа ÷ площадь листа
  if(f&&f!==1&&l.srcQty) l.qty=Math.round(Number(l.srcQty)*f*1000)/1000;
  twTlRender(); }
function twTlSrc(i){ twTlRead(); var l=TWTL.lines[i], m=twTlMat(l.name), f=twTlFactor(m,l.unit); if(f){ l.qty=Math.round(Number(l.srcQty)*f*1000)/1000; el('tlq'+i).value=l.qty; } twTlSum(); }
function twTlSum(){ var t=0, pl=0, ms=0; TWTL.lines.forEach(function(l,i){ if(!el('tlq'+i)) return; var s=Math.round((Number(val('tlq'+i))||0)*(Number(val('tlp'+i))||0)*100)/100; t+=s; el('tlsm'+i).textContent=money(s);
  pl+=Number(el('tlpc'+i)&&val('tlpc'+i))||0; ms+=Number(el('tlms'+i)&&val('tlms'+i))||0; });
  el('tlsum').textContent=money(t); if(el('tlpl2')) el('tlpl2').textContent=pl||''; if(el('tlms2')) el('tlms2').textContent=ms?twTlNum(ms):''; }

/* ══════════ список передач ══════════ */
var TL_ST={ issued:['warn','у переработчика'], returned:['ok','вернулось'], cancelled:['muted','отменена'] };
function twTollingBlock(boxId, cpKey){
  var box=el(boxId); if(!box) return; TWTLB={ box:boxId, cp:cpKey||'' }; box.innerHTML='Загрузка…';
  get({vapi:'tollinglist', counterparty:cpKey||''}).then(function(r){
    if(!r||!r.ok){ box.innerHTML='<span class="err">⚠️ '+esc(errText(r))+'</span>'; return; }
    var rows=TWTLB.rows=r.rows||[];
    var head='<div class="row" style="margin-bottom:var(--s-2)"><span class="pill warn">у переработчика '+esc(r.atContractor||0)+(r.atContractorSum?' · '+money(r.atContractorSum)+' р.':'')+'</span><span class="sm">· передач '+rows.length+'</span></div>';
    if(!rows.length){ box.innerHTML=head+'<div class="empty">Передач ещё не было.</div>'; return; }
    box.innerHTML=head+'<div class="tbl-wrap fill"><table class="tbl reg mob adapt"><thead><tr><th>№ / дата</th><th>Переработчик</th><th>Что передали</th><th class="num">Сумма</th><th>Статус</th><th></th></tr></thead><tbody>'
      +rows.map(function(x,i){ var st=TL_ST[x.status]||['',''];
        var what=(x.lines||[]).map(function(l){ return esc(l.name)+' — '+twTlNum(l.qty)+' '+esc(l.unit); }).join('<br>');
        var act=(x.docUrl?'<a href="'+esc(x.docUrl)+'" target="_blank" rel="noopener">файл ↗</a>':'')+(x.signedUrl?'<a href="'+esc(x.signedUrl)+'" target="_blank" rel="noopener">скан ↗</a>':'')
          +(x.status==='issued'?'<button onclick="twTlReturn('+i+')" title="материал вернулся от переработчика">↩ вернулось</button><button class="danger" onclick="twTlCancel('+i+')" title="отменить накладную (бланк станет испорченным)">✕</button>':'')
          +(x.status==='returned'?'<button class="sec" onclick="twTlUnreturn('+i+')" title="отметили возврат по ошибке">снова у переработчика</button>':'');
        return '<tr'+(x.status==='cancelled'?' class="sp"':'')+'><td data-l="№" style="white-space:nowrap"><b>'+esc(x.number)+'</b><span class="sub2">'+esc([x.kind+(x.blank?' '+x.blank:''), x.date].join(' · '))+'</span></td>'
          +'<td data-l="Переработчик">'+esc(x.counterparty)+'<div class="sm muted">'+esc(x.basis)+'</div></td><td data-l="Что" class="sm">'+what+(x.note?'<div class="muted">'+esc(x.note)+'</div>':'')+'</td>'
          +'<td data-l="Сумма" class="num">'+money(x.amount)+'</td><td data-l="Статус"><span class="pill '+st[0]+'">'+st[1]+(x.status==='returned'&&x.returnedAt?' '+esc(x.returnedAt):'')+'</span>'+(x.returnNote?'<div class="sm">'+esc(x.returnNote)+'</div>':'')+'</td>'
          +'<td class="acts2">'+act+'</td></tr>'; }).join('')+'</tbody></table></div>';
  }).catch(function(e){ box.innerHTML='<span class="err">'+esc(netText(e))+'</span>'; });
}
function twTlRefresh(){ twTollingBlock(TWTLB.box, TWTLB.cp); }
function twTlReturn(i){ var x=TWTLB.rows[i];
  ask('↩ Вернулось: '+x.number+' — '+x.counterparty, '<label style="display:block"><span class="sm muted">Дата возврата</span><input id="tlrd" value="'+esc(twTlToday())+'" placeholder="дд.мм.гггг" style="width:100%"></label>'
    +'<label style="display:block;margin-top:var(--s-2)"><span class="sm muted">Накладная переработчика (номер, дата)</span><input id="tlrn" placeholder="ТН ЛБ 0001234 от 05.11.2026" style="width:100%"></label><div class="msg" id="tlrm"></div>',
    function(){ run({vapi:'tollingreturn', id:x.id, date:val('tlrd').trim(), note:val('tlrn').trim()}, 'Отмечаю возврат…', 'tlrm').then(function(r){ if(r){ hide('askmodal'); twTlRefresh(); } }); return false; }, 'Вернулось'); }
function twTlUnreturn(i){ var x=TWTLB.rows[i]; run({vapi:'tollingunreturn', id:x.id}, 'Возвращаю статус…').then(function(r){ if(r) twTlRefresh(); }); }
function twTlCancel(i){ var x=TWTLB.rows[i];
  ask('Отменить передачу '+x.number+'?', '<div>Накладная '+esc(x.kind)+(x.blank?' '+esc(x.blank):'')+' уйдёт в корзину, бланк строгой отчётности станет испорченным и повторно не выдаётся.</div>',
    function(){ run({vapi:'tollingcancel', id:x.id, reason:'отмена из списка передач'}, 'Отменяю…').then(function(r){ if(r) twTlRefresh(); }); }, 'Отменить'); }
