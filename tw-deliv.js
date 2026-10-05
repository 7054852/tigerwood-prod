/* Смена способа и адреса доставки (05.10.2026): клиент передумал — правка в сделке (dealupdate), договор не переделывается
   (в условиях доставки — право сменить адрес сообщением до отгрузки); накладные берут адрес из сделки.
   Один диалог на карточку сделки (sales.html) и договора (contract.html). Ждёт от страницы: ask, run, esc, val, setm.
   twDelivEdit(dealKey, deal{deliveryMethod, city, deliveryAddress}, msgId, onDone). */
function twDelivEdit(dealKey, d, msgId, onDone){
  d = d || {}; var m = d.deliveryMethod || '', way = /самовывоз/i.test(m) ? 'pick' : /белпочт/i.test(m) ? 'bel' : /почт/i.test(m) ? 'euro' : 'del';
  var opt = function(v, t){ return '<option value="' + v + '"' + (v === way ? ' selected' : '') + '>' + t + '</option>'; };
  ask('Способ и адрес доставки', '<label class="fl"><span class="sm">Способ</span><select id="dvWay">' + opt('del', 'Доставка домой') + opt('euro', 'До отделения Европочты') + opt('bel', 'До отделения Белпочты') + opt('pick', 'Самовывоз') + '</select></label>'
    + '<label class="fl" style="margin-top:var(--s-2)"><span class="sm">Город / населённый пункт</span><input id="dvCity" value="' + esc(d.city || '') + '" autocomplete="off"></label>'
    + '<label class="fl" style="margin-top:var(--s-2)"><span class="sm">Адрес доставки или номер и адрес отделения</span><input id="dvAddr" value="' + esc(d.deliveryAddress || '') + '" autocomplete="off"></label>'
    + '<div class="sm" style="margin-top:var(--s-2)">Договор переделывать не нужно: клиент вправе сменить адрес сообщением до отгрузки. Накладные возьмут новый адрес. Если договор ещё не подписан — его можно переформировать (номер тот же).</div><div class="msg" id="dvMsg"></div>',
    function(){ var w = val('dvWay'), f = { deliveryMethod: w === 'pick' ? 'самовывоз' : w === 'euro' ? 'Европочта' : w === 'bel' ? 'Белпочта' : (/самовывоз|почт/i.test(m) || !m ? 'доставка' : m), city: val('dvCity').trim(), deliveryAddress: val('dvAddr').trim() };
      if(w !== 'pick' && !f.deliveryAddress && !f.city){ setm('dvMsg', 'err', 'Укажите адрес или отделение'); return false; }
      run({ vapi: 'dealupdate', deal: dealKey, data: JSON.stringify(f) }, 'Сохраняю доставку…', msgId).then(function(r){ if(!r) return;
        setm(msgId, 'ok', '✅ Доставка изменена'); if(onDone) onDone(r); }); }, 'Сохранить');
}
