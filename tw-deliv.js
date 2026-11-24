/* Смена способа и адреса доставки (05.10.2026): клиент передумал — правка в сделке (dealupdate), договор не переделывается
   (в условиях доставки — право сменить адрес сообщением до отгрузки); накладные берут адрес из сделки.
   Один диалог на карточку сделки (sales.html) и договора (contract.html). Ждёт от страницы: ask, run, esc, val, setm.
   twDelivEdit(dealKey, deal{deliveryMethod, city, deliveryAddress, pickupDate, deliveryDate}, msgId, onDone).
   24.11.2026: даты забора со склада и доставки клиенту — здесь же (раньше ставились только в лиде amoCRM, у сделки Прохаба их негде было ввести). */
function twDelivEdit(dealKey, d, msgId, onDone){
  d = d || {}; var m = d.deliveryMethod || '', way = /самовывоз/i.test(m) ? 'pick' : /белпочт/i.test(m) ? 'bel' : /почт/i.test(m) ? 'euro' : 'del';
  var iso = function(x){ x = String(x || ''); var k = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(x); return k ? k[3] + '-' + k[2] + '-' + k[1] : /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : ''; };
  var opt = function(v, t){ return '<option value="' + v + '"' + (v === way ? ' selected' : '') + '>' + t + '</option>'; };
  ask('Доставка: способ, адрес, даты', '<label class="fl"><span class="sm">Способ</span><select id="dvWay">' + opt('del', 'Доставка домой') + opt('euro', 'До отделения Европочты') + opt('bel', 'До отделения Белпочты') + opt('pick', 'Самовывоз') + '</select></label>'
    + '<label class="fl" style="margin-top:var(--s-2)"><span class="sm">Город / населённый пункт</span><input id="dvCity" value="' + esc(d.city || '') + '" autocomplete="off"></label>'
    + '<label class="fl" style="margin-top:var(--s-2)"><span class="sm">Адрес доставки или номер и адрес отделения</span><input id="dvAddr" value="' + esc(d.deliveryAddress || '') + '" autocomplete="off"></label>'
    + '<div class="row" style="margin-top:var(--s-2);gap:var(--s-3)"><label class="fl"><span class="sm">Дата забора со склада</span><input id="dvPick" type="date" value="' + iso(d.pickupDate) + '"></label>'
    + '<label class="fl"><span class="sm">Дата доставки клиенту</span><input id="dvDate" type="date" value="' + iso(d.deliveryDate) + '"></label></div>'
    + '<div class="sm" style="margin-top:var(--s-2)">Договор переделывать не нужно: клиент вправе сменить адрес сообщением до отгрузки. Накладные возьмут новый адрес. Если договор ещё не подписан — его можно переформировать (номер тот же).</div><div class="msg" id="dvMsg"></div>',
    function(){ var w = val('dvWay'), f = { deliveryMethod: w === 'pick' ? 'самовывоз' : w === 'euro' ? 'Европочта' : w === 'bel' ? 'Белпочта' : (/самовывоз|почт/i.test(m) || !m ? 'доставка' : m), city: val('dvCity').trim(), deliveryAddress: val('dvAddr').trim(), pickupDate: val('dvPick'), deliveryDate: val('dvDate') };
      if(w !== 'pick' && !f.deliveryAddress && !f.city){ setm('dvMsg', 'err', 'Укажите адрес или отделение'); return false; }
      run({ vapi: 'dealupdate', deal: dealKey, data: JSON.stringify(f) }, 'Сохраняю доставку…', msgId).then(function(r){ if(!r) return;
        setm(msgId, 'ok', '✅ Доставка изменена'); if(onDone) onDone(r); }); }, 'Сохранить');
}
