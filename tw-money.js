/* Деньги по договору (владелец 14.10.2026): договор — контейнер оплат. Общая вёрстка для карточки договора (contract.html)
   и карточки контрагента (counterparties.html). Ждёт от страницы esc(), money(), ruDate(). Данные — finance/contractMoney.ts:
   obligation / prelim / paid / paidBefore / left / advance / prepayLeft / afterShip / overdue / supplies[] / otherPaid. */
function twMoneyHtml(m, o){
  o=o||{}; var c=' '+esc(m.currency||''), fw=m.isFramework;
  var basis=fw?(m.prelim?'предварительно — по счетам; после отгрузки считается по инвойсу / ТН':'по отгрузкам (инвойсы / ТН)'):'сумма договора';
  var top='<div class="row" style="gap:var(--s-4);flex-wrap:wrap;align-items:flex-start">'
    +'<div style="flex:1 1 160px"><div class="sm muted">Клиент должен всего</div><div style="font:var(--t-title)">'+money(m.obligation)+c+'</div><div class="sm muted">'+esc(basis)+(fw&&m.amount!=null?' · ориентир договора '+money(m.amount)+c:'')+'</div></div>'
    +'<div style="flex:1 1 140px"><div class="sm muted">Внесено</div><div style="font:var(--t-title)">'+money(m.paid)+c+'</div>'+(m.paidBefore>0.009?'<div class="sm muted">из них '+money(m.paidBefore)+' — до начала учёта</div>':'')+'</div>'
    +(m.advance>0.009?'<div style="flex:1 1 160px"><div class="sm muted">Аванс</div><div style="font:var(--t-title)" class="ok">'+money(m.advance)+c+'</div><div class="sm muted">зачтётся в следующий счёт</div></div>'
      :'<div style="flex:1 1 160px"><div class="sm muted">Осталось</div><div style="font:var(--t-title)">'+money(m.left)+c+'</div><div class="sm muted">'+(m.prepayLeft>0.009?'предоплата '+money(m.prepayLeft):'')+(m.prepayLeft>0.009&&m.afterShip>0.009?' · ':'')+(m.afterShip>0.009?'после отгрузки '+money(m.afterShip):'')+(m.overdue>0.009?' · <span class="err">просрочено '+money(m.overdue)+'</span>':'')+'</div></div>')
    +'</div>';
  if(!m.supplies.length) return top+(m.otherPaid>0.009?'<div class="sm muted" style="margin-top:var(--s-2)">Оплаты без счёта: '+money(m.otherPaid)+c+'</div>':'');
  var rows=m.supplies.map(function(s){
    var pre=s.prepay==null?'—':(s.prepayLeft>0.009?'внесено '+money(s.prepay-s.prepayLeft)+' из '+money(s.prepay)+'<div>осталось <b>'+money(s.prepayLeft)+'</b></div>':'<span class="pill ok">внесена</span>');
    var full=s.obligation-s.paid<=0.009;
    var bal=full?'<span class="pill ok">оплачен</span>'+(s.over>0.009?'<div class="muted">сверх '+money(s.over)+'</div>':''):s.balanceLeft<=0.009?'—'
      :(s.shipped?'<b>'+money(s.balanceLeft)+'</b>'+(s.dueIso?'<div'+(s.overdue?' class="err"':'')+'>до '+esc(ruDate(s.dueIso))+(s.overdue?' · просрочено':'')+'</div>':''):money(s.balanceLeft)+'<div class="muted">после отгрузки</div>');
    var ob=money(s.obligation)+'<div class="muted">'+esc(s.basis)+(s.final!=null&&Math.abs(s.final-s.proforma)>0.009?' · счёт '+money(s.proforma):'')+'</div>';
    return '<tr><td data-l="Поставка"><b>'+esc(s.invoice)+'</b> <span class="muted">от '+esc(ruDate(s.invoiceDateIso))+'</span>'+(s.dealNum?'<div class="muted">'+esc(s.dealNum)+(s.shipped?' · отгружено':'')+'</div>':'')+'</td>'
      +'<td data-l="Обязательство" class="num">'+ob+'</td><td data-l="Внесено" class="num">'+money(s.paid)+'</td><td data-l="Предоплата">'+pre+'</td><td data-l="Остаток">'+bal+'</td></tr>';
  }).join('');
  return top+'<div class="tbl-wrap" style="margin-top:var(--s-3)"><table class="tbl sm mob"><thead><tr><th>Поставка / счёт</th><th class="num">Обязательство'+c+'</th><th class="num">Внесено</th><th>Предоплата</th><th>Остаток</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +(m.otherPaid>0.009?'<div class="sm muted" style="margin-top:var(--s-2)">Оплаты по договору без счёта: '+money(m.otherPaid)+c+'</div>':'');
}
