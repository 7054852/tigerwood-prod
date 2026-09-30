/* Диалог накладной ТН/ТТН (бриф 30.09.2026): один на карточку сделки (sales.html), карточку договора (contract.html) и реестр (salesdocs.html).
   wbprep(deal, kind) → дата отгрузки (= дата накладной; по умолчанию правка накладной / дата забора / дата доставки), адрес доставки
   (правка / «Адрес доставки ЮЛ» / адрес сделки), заказчик перевозки (договор → amoCRM → «Мы»), водитель, автомобиль, прицеп, путевой лист,
   места/масса по позициям → wbissue(deal, kind, data) сохраняет всё у сделки (waybill.ts saveWaybillData) и формирует документ.
   Ждёт от страницы: get, run, ask, hide, info, oops, errText, el, val, esc, setm. twWaybill(dealKey, 'ТН'|'ТТН', onDone). */
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
    var body=miss
      +'<div class="sm" style="margin-bottom:var(--s-2)">Клиент: <b>'+esc(p.client)+'</b>'+(p.contract?(' · '+esc(p.contract)):' · <span class="err">договор не привязан</span>')+(p.num?(' · заказ '+esc(p.num)):'')+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 var(--s-3)">'
      +inp('wbd','📅 Дата отгрузки (= дата накладной) — проверьте!', p.date, 'дд.мм.гггг')
      +'<label style="'+L+'"><span style="'+SM+'">Заказчик перевозки</span><select id="wbf" style="width:100%"><option value="Мы"'+(p.freight!=='Клиент'?' selected':'')+'>Мы (Тигервуд)</option><option value="Клиент"'+(p.freight==='Клиент'?' selected':'')+'>Клиент</option></select></label>'
      +'<label style="'+L+';grid-column:1 / -1"><span style="'+SM+'">📍 Адрес доставки — проверьте!</span><input id="wba" value="'+esc(p.address)+'" autocomplete="off" style="width:100%"></label>'
      +inp('wbdr','Водитель', p.driver)+inp('wbcar','Автомобиль', p.car)+inp('wbtr','Прицеп', p.trailer)+inp('wbpl','Путевой лист', p.waybillDoc)
      +'</div>'
      +'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm mob wbt"><thead><tr><th>Наименование</th><th class="num">Кол-во</th><th>Мест</th><th>Масса, кг</th></tr></thead>'
      +'<tbody>'+rows+'<tr style="font-weight:600"><td>Итого</td><td></td><td data-l="Мест" id="wbtp">0</td><td data-l="Масса, кг" id="wbtm">0</td></tr></tbody></table></div>'
      +'<label class="sm" style="display:block;margin-top:var(--s-3)"><input type="checkbox" id="wbc"> Я проверил <b>дату</b> и <b>адрес</b></label>'
      +'<div class="msg" id="wbm"></div>';
    ask('✍️ Выписать '+kind, body, function(){
      var date=val('wbd').trim(), addr=val('wba').trim();
      if(!date){ setm('wbm','err','Укажите дату накладной'); return false; }
      if(!el('wbc').checked){ setm('wbm','err','Отметьте, что проверили дату и адрес'); return false; }
      var payload={ date:date, address:addr, freight:val('wbf'), driver:val('wbdr').trim(), car:val('wbcar').trim(), trailer:val('wbtr').trim(), waybillDoc:val('wbpl').trim(),
        items:(TWWB.items||[]).map(function(it){ return {places:Number(it.places)||0, mass:Number(it.mass)||0}; }) };
      run({vapi:'wbissue', deal:dealKey, kind:kind, data:JSON.stringify(payload)}, 'Формирую накладную…', 'wbm').then(function(r){ if(!r) return;
        twWbDlg('dlg'); hide('askmodal');
        info('Накладная сформирована', '<div>✅ '+esc(kind)+(r.waybill?(' · № бланка <b>'+esc(r.waybill)+'</b>'):'')+': <a href="'+esc(r.url)+'" target="_blank" rel="noopener">открыть/печать</a></div>');
        if(onDone) onDone(r);
      });
      return false;   // окно закроем после ответа сервера
    }, 'Сформировать накладную');
    twWbDlg('dlg md');
    el('askNo').onclick=function(){ hide('askmodal'); twWbDlg('dlg'); };
    twWbSums();
  }).catch(function(e){ oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twWbDlg(cls){ var d=el('askmodal').querySelector('.dlg'); if(d) d.className=cls; }
function twWbSums(){ var pl=0,ms=0; ((TWWB&&TWWB.items)||[]).forEach(function(it){ pl+=Number(it.places)||0; ms+=Number(it.mass)||0; });
  var a=el('wbtp'), b=el('wbtm'); if(a) a.textContent=pl; if(b) b.textContent=Math.round(ms*100)/100; }
