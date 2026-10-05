/* Оплата онлайн (05.10.2026): ссылки «Экспресс Платежей» ЕРИП / картой к договору физлица и «оплачено / остаток».
   Один блок на карточку договора (contract.html — можно создавать ссылки) и карточку сделки (sales.html — смотреть, копировать, проверять).
   Ждёт от страницы: run, ask, info, esc, money, el, setm. twPay(boxId, pay, {contract, canCreate, onDone}). */
var TWPAY = { box: '', opts: {} };
function twPay(boxId, pay, opts){
  TWPAY.box = boxId; TWPAY.opts = opts || {};
  var box = el(boxId); if(!box) return;
  if(!pay){ box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  var links = pay.links || [], o = TWPAY.opts, h = '<div class="h">💳 Оплата онлайн (ЕРИП / карта)</div>';
  if(pay.total > 0){
    var inst = pay.dueByToday !== pay.total;
    h += '<div class="note ' + (pay.rest <= 0 ? 'ok' : (pay.overdue > 0 && inst ? 'warn' : '')) + '"><div>Оплачено <b>' + money(pay.paid) + '</b> из ' + money(pay.total) + ' руб. · остаток <b>' + money(pay.rest) + '</b>'
      + (inst ? ' · по графику на сегодня ' + money(pay.dueByToday) + (pay.overdue > 0 ? ' — <b>просрочено ' + money(pay.overdue) + '</b>' : '') : '') + '</div></div>';
  }
  h += links.length ? links.map(function(l){
    var cls = l.status === 'paid' ? 'ok' : l.status === 'partial' ? 'info' : (l.status === 'expired' || l.status === 'cancelled') ? 'muted' : 'warn';
    var live = l.status === 'active' || l.status === 'partial';
    return '<div class="docrow"><span><b>' + esc(l.methodRu) + '</b> № ' + esc(l.accountNo) + ' <span class="sm">' + money(l.amount) + ' руб.' + (l.amountEditable ? ' (можно частями)' : '')
      + (l.expires ? ' · до ' + esc(l.expires) : '') + (l.paid ? ' · оплачено ' + money(l.paid) : '') + '</span></span>'
      + '<span class="pill ' + cls + '">' + esc(l.statusRu) + '</span>'
      + '<span class="sp">' + (live && l.url ? '<button class="sec sm" onclick="twPayCopy(\'' + esc(l.url) + '\')">📋 Скопировать ссылку</button> <a href="' + esc(l.url) + '" target="_blank" rel="noopener">открыть ↗</a>' : '')
      + (o.canCreate && l.status === 'active' && !l.paid ? ' <button class="gho sm" onclick="twPayCancel(\'' + esc(l.id) + '\')">отменить</button>' : '') + '</span></div>';
  }).join('') : '<div class="sm">Ссылок на оплату нет.</div>';
  h += '<div class="row" style="margin-top:var(--s-2)">';
  if(o.canCreate && pay.rest > 0){
    h += '<button class="sec sm" onclick="twPayNew(\'erip\')">＋ Ссылка ЕРИП</button><button class="sec sm" onclick="twPayNew(\'card\')">＋ Ссылка на оплату картой</button>';
  }
  if(links.length) h += '<button class="gho sm" onclick="twPayCheck()">🔄 Проверить оплату</button>';
  if(!pay.configured) h += '<span class="sm warn">Оплата онлайн не настроена: нет ключа «Экспресс Платежей».</span>';
  h += '</div><div class="msg" id="twpaymsg"></div>';
  box.innerHTML = h;
}
function twPayCopy(url, msgId){
  var done = function(){ setm(msgId || 'twpaymsg', 'ok', '✅ Ссылка скопирована — отправьте её клиенту'); };
  try { navigator.clipboard.writeText(url).then(done, function(){ prompt('Скопируйте ссылку', url); }); } catch(e){ prompt('Скопируйте ссылку', url); }
}
function twPayNew(method){
  var o = TWPAY.opts;
  if(method === 'erip'){
    run({ vapi: 'paylinkcreate', contract: o.contract, method: 'erip' }, 'Создаю ссылку ЕРИП…', 'twpaymsg').then(twPayDone);
    return;
  }
  ask('Ссылка на оплату картой', '<label class="fl"><span class="sm">Сумма, руб. (пусто — весь остаток)</span><input id="twPayAmt" type="number" inputmode="decimal" min="0" step="0.01" autocomplete="off"></label><div class="msg" id="twPayAskMsg"></div>',
    function(){ var a = (el('twPayAmt') || {}).value || '';
      run({ vapi: 'paylinkcreate', contract: o.contract, method: 'card', amount: a }, 'Создаю ссылку на оплату картой…', 'twpaymsg').then(twPayDone); }, 'Создать');
}
function twPayDone(r){
  if(!r) return;
  if(r.link && r.link.url) info(r.existing ? 'Ссылка уже есть' : 'Ссылка создана', '<div>' + esc(r.link.methodRu) + ' № ' + esc(r.link.accountNo) + ' · ' + money(r.link.amount) + ' руб.' + (r.dealNum ? ' · заказ ' + esc(r.dealNum) : '') + '</div>'
    + '<div style="margin-top:var(--s-2);word-break:break-all"><a href="' + esc(r.link.url) + '" target="_blank" rel="noopener">' + esc(r.link.url) + '</a></div>'
    + '<div class="row" style="margin-top:var(--s-2)"><button class="green sm" onclick="twPayCopy(\'' + esc(r.link.url) + '\', \'twPayDlgMsg\')">📋 Скопировать ссылку</button><span class="msg" id="twPayDlgMsg"></span></div>'
    + '<div class="sm" style="margin-top:var(--s-2)">Отправьте ссылку клиенту — в мессенджере или по почте.</div>');
  if(r.pay) twPay(TWPAY.box, r.pay, TWPAY.opts);
  if(TWPAY.opts.onDone) TWPAY.opts.onDone(r);
}
function twPayCheck(){
  var o = TWPAY.opts;
  run({ vapi: 'paylinkrefresh', contract: o.contract || '', deal: o.deal || '' }, 'Проверяю оплату…', 'twpaymsg').then(function(r){ if(!r) return;
    if(r.pay) twPay(TWPAY.box, r.pay, TWPAY.opts);
    setm('twpaymsg', 'ok', r.fresh > 0 ? '✅ Новая оплата: ' + money(r.fresh) + ' руб.' : 'Новых оплат нет'); if(r.fresh > 0 && o.onDone) o.onDone(r); });
}
function twPayCancel(id){
  ask('Отменить ссылку?', '<div>Клиент больше не сможет оплатить по этой ссылке.</div>', function(){
    run({ vapi: 'paylinkcancel', id: id }, 'Отменяю ссылку…', 'twpaymsg').then(function(r){ if(r && r.pay) twPay(TWPAY.box, r.pay, TWPAY.opts); }); }, 'Отменить ссылку');
}
