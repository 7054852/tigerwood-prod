/* Расчёт с сотрудниками — один экран для «Финансы → Зарплата → Долг по сотрудникам» и «Кадры → Зарплата → Долг» (владелец 04.11.2026).
   Модель (prohub src/payroll/debt.ts): начислено — наряды до налогов, одинаково для штата и подряда; погашено — штат: выплачено,
   подряд: выплачено ÷ 0,86 (подоходный и пенсионный удерживаем мы); на руки — сколько человек получил. Долг — только закрытые месяцы,
   выплаты гасят его сразу, сверх — «наперёд»; текущий месяц копится и входит в долг с 1-го числа следующего.
   Модуль самодостаточный: свои форматы и своё окно; от страницы — чтение (api), запись (post) и имена маршрутов.
   twPayroll.mount(el, { api, post, who:'finance'|'hr', routes:{ load, set, cash, adjust? }, onChange? }); twPayroll.reload(); twPayroll.open(personId). */
(function(){
  var S={ el:null, o:null, d:null, q:'', chip:'', all:false, pid:null, msg:'', loading:0 };
  var MON=['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var r2=function(x){ return Math.round((Number(x)||0)*100)/100; };
  var money=function(x){ return r2(x).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var mon=function(ym){ return ym?MON[+ym.slice(5,7)]:''; }, monS=function(ym){ return mon(ym).slice(0,3); };
  var monY=function(ym){ return ym?mon(ym)+' '+ym.slice(0,4):''; };
  var dmy=function(iso){ return iso?iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4):''; };
  var nextYm=function(ym){ var y=+ym.slice(0,4), m=+ym.slice(5,7)+1; if(m>12){ m=1; y++; } return y+'-'+(m<10?'0':'')+m; };
  var prevYm=function(ym){ var y=+ym.slice(0,4), m=+ym.slice(5,7)-1; if(m<1){ m=12; y--; } return y+'-'+(m<10?'0':'')+m; };
  var key=function(){ return 'ui-'+Date.now()+'-'+Math.random().toString(36).slice(2,10); };
  var num=function(v){ return Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); };
  var isPodr=function(r){ return /^подряд/.test(r.kind||''); };
  var noCon=function(r){ return r.kind==='—' || /нет договора/.test(r.kind||'') || r.noContract>0.004; };
  var $=function(id){ return document.getElementById(id); };
  var mOf=function(r,ym){ return (r.months&&r.months[ym])||{ earned:0, adj:0, hands:0, settled:0, paid:0, closed:ym<(S.d&&S.d.curYm) }; };

  /* ── данные ── */
  function load(){
    S.loading=1; draw();
    return S.o.api({ vapi:S.o.routes.load }).then(function(r){ S.loading=0; if(!r||!r.ok){ S.d=null; S.msg=(r&&r.error)||'Не загрузилось — нажмите «Обновить».'; draw(); return; } S.d=r; S.msg=''; draw(); if(S.pid!==null) card(); },
      function(e){ S.loading=0; S.msg='Связь оборвалась: '+((e&&e.message)||e); draw(); });
  }
  /* ответ записи: полный экран (set), {ok, debt} (cash) или только ok (правка итога) — тогда перечитать */
  function took(r, ok){
    if(!r) return false;
    if(r.ok===false){ say('bad', r.error||'Не сохранено.'); return false; }
    var d=r.rows?r:(r.debt&&r.debt.rows?r.debt:null);
    if(d){ S.d=d; draw(); card(); } else load();
    if(S.o.onChange) S.o.onChange();
    if(ok) say('ok', ok);
    return true;
  }
  function post(q, ok){ say('', ''); return Promise.resolve(S.o.post(q)).then(function(r){ return took(r, ok); }, function(e){ say('bad','Связь оборвалась: '+((e&&e.message)||e)+'. Обновите и проверьте, прошла ли запись.'); return false; }); }

  /* ── экран ── */
  function rowsAll(){ return (S.d&&S.d.rows)||[]; }
  function months(){
    var set={}, cur=S.d.curYm; rowsAll().forEach(function(r){ Object.keys(r.months||{}).forEach(function(m){ if(m<cur) set[m]=1; }); });
    return Object.keys(set).sort();
  }
  function visible(r){
    if(S.q && (r.name||'').toLowerCase().indexOf(S.q)<0) return false;
    if(S.chip==='shtat' && !/^штат/.test(r.kind)) return false;
    if(S.chip==='podr' && !isPodr(r)) return false;
    if(S.chip==='nocon' && !noCon(r)) return false;
    if(S.all || S.q) return true;
    var c=r.current||{};
    return (r.debt!==null && Math.abs(r.debt)>0.004) || (c.earned||0)>0.004 || (c.paid||0)>0.004;
  }
  function debtHtml(r, big){
    if(r.debt===null) return '<span class="muted" title="наряды не основа оплаты — долг по ведомости">по окладу</span>';
    if(r.debt< -0.004) return '<b class="twp-plus" title="выплачено больше, чем начислено за закрытые месяцы">наперёд '+money(-r.debt)+'</b>';
    if(r.debt> 0.004) return '<b class="twp-neg">'+money(r.debt)+'</b>';
    return '<span class="muted">0</span>';
  }
  /* «погашено» у штата = выплачено; у подряда — погашено (до налогов) и на руки */
  function paidLine(m, podr){
    if(!(m.paid>0.004)) return '';
    return podr&&Math.abs(m.settled-m.paid)>0.004 ? 'погашено '+money(m.settled)+' · на руки '+money(m.paid) : 'выплачено '+money(m.paid);
  }
  function cell(m, podr, lbl, cls){
    var e=r2((m.earned||0)+(m.adj||0)), p=paidLine(m, podr);
    var t=m.adj?' title="наряды '+money(m.earned)+(m.adj>0?' + ':' − ')+'правка '+money(Math.abs(m.adj))+'"':'';
    return '<td class="num'+(cls?' '+cls:'')+'" data-l="'+esc(lbl)+'"'+t+'>'+(e?money(e):(p?'<span class="muted">—</span>':''))+(p?'<span class="sub2">'+p+'</span>':'')+'</td>';
  }
  function sumM(list){ var s={ earned:0, adj:0, hands:0, settled:0, paid:0 }; list.forEach(function(m){ for(var k in s) s[k]+=m[k]||0; }); return s; }

  function draw(){
    if(!S.el) return;
    var o=S.o;
    var top='<div class="toolbar"><input type="search" class="search" placeholder="Сотрудник" value="'+esc(S.q)+'" oninput="twPayroll._q(this.value)" aria-label="Поиск сотрудника">'
      +'<div class="chips" role="group" aria-label="Вид">'+[['','Все'],['shtat','Штат'],['podr','Подряд'],['nocon','Без договора']].map(function(c){ return '<button type="button" class="chip'+(S.chip===c[0]?' on':'')+'" onclick="twPayroll._chip(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div>'
      +'<label><input type="checkbox"'+(S.all?' checked':'')+' onchange="twPayroll._all(this.checked)"> и нулевые</label>'
      +'<div class="end"><button class="sec ib" title="Обновить" aria-label="Обновить" onclick="twPayroll.reload()">↻</button><button onclick="twPayroll.open(\'\')">Выдать / отсечка</button></div></div>'
      +'<div class="note hint"><div><b>Начислено</b> — принятые наряды до налогов, одинаково для штата и подряда. <b>Погашено</b> — сколько долга закрыла выплата: у штата это выплаченная сумма, у подряда — выплачено ÷ 0,86 (подоходный 13 % и пенсионный 1 % удерживаем и платим мы). <b>На руки</b> — что человек получил на карту или наличными. <b>Должны</b> — долг на 13.09 + начислено за закрытые месяцы − всё погашенное; текущий месяц копится и войдёт в долг 1-го числа следующего, а выплаты гасят долг сразу — сверх долга «наперёд». Тот же расчёт — в «Финансах» и в «Кадрах». Нажмите на строку — карточка человека: по месяцам, выплаты, выдача наличными, отсечка.</div></div>';
    if(!S.d){ S.el.innerHTML=top+'<div class="empty">'+(S.loading?'Считаю…':esc(S.msg||''))+'</div>'; hint(); return; }
    var d=S.d, cur=d.curYm, all=rowsAll(), ms=months(), shown=ms.slice(-2), older=ms.slice(0,-2);
    // показатели — по всем людям (не по фильтру), подписаны: что входит в долг, что копится
    var owed=0, ahead=0, nOwed=0, c={ earned:0, settled:0, paid:0 };
    all.forEach(function(r){ if(r.debt>0.004){ owed+=r.debt; nOwed++; } else if(r.debt< -0.004) ahead-=r.debt; var x=r.current||{}; c.earned+=x.earned||0; c.settled+=x.settled||0; c.paid+=x.paid||0; });
    var endPrev=dmy(new Date(Date.UTC(+cur.slice(0,4), +cur.slice(5,7)-1, 0)).toISOString().slice(0,10));   // последний день прошлого месяца
    var kp='<div class="kpis">'
      +'<span class="k" title="долг на 13.09 + начислено по '+endPrev+' включительно − всё погашенное">Должны <b class="twp-neg">'+money(owed)+'</b> <i>'+nOwed+' чел., начислено по '+endPrev+'</i></span>'
      +(ahead>0.004?'<span class="k" title="выплачено больше, чем начислено за закрытые месяцы">Наперёд <b class="twp-plus">'+money(ahead)+'</b></span>':'')
      +'<span class="k" title="'+esc(mon(cur))+' ещё идёт: начисленное войдёт в долг '+dmy(nextYm(cur)+'-01')+'">'+esc(mon(cur)[0].toUpperCase()+mon(cur).slice(1))+' идёт: начислено <b>'+money(c.earned)+'</b> <i>в долг с '+dmy(nextYm(cur)+'-01')+'</i></span>'
      +'<span class="k">погашено <b>'+money(c.settled)+'</b></span><span class="k">на руки <b>'+money(c.paid)+'</b></span></div>';
    var rows=all.filter(visible);
    var head='<tr><th>Сотрудник</th><th class="num" title="долг до налогов на 13.09.2026">На 13.09</th>'+(older.length?'<th class="num" title="'+esc(older.map(monY).join(', '))+'">Раньше</th>':'')
      +shown.map(function(m){ return '<th class="num">'+esc(monS(m))+'</th>'; }).join('')
      +'<th class="num twp-cur" title="месяц идёт — в долг не входит до '+dmy(nextYm(cur)+'-01')+'">'+esc(monS(cur))+' · идёт</th><th class="num">Должны</th></tr>';
    var body=rows.map(function(r){
      var podr=isPodr(r), sub=[esc(r.kind==='—'?'вид не указан':r.kind.replace(/ \(нет договора\)$/,''))];
      if(r.payFor&&r.payFor.length) sub.push('платим за него: '+esc(r.payFor.join(', ')));
      return '<tr class="go" onclick="twPayroll.open(\''+r.personId+'\')" tabindex="0" onkeydown="if(event.key===\'Enter\')twPayroll.open(\''+r.personId+'\')">'
        +'<td data-l="Сотрудник"><span class="twp-name">'+esc(r.name)+'</span>'+(noCon(r)?' <span class="pill warn">без договора</span>':'')+(r.openingNote?' <span class="muted" title="'+esc(r.openingNote)+'">✎</span>':'')+'<span class="sub2">'+sub.join(' · ')+'</span></td>'
        +'<td class="num" data-l="На 13.09">'+(r.opening?money(r.opening):'')+'</td>'
        +(older.length?cell(sumM(older.map(function(m){ return mOf(r,m); })), podr, 'Раньше'):'')
        +shown.map(function(m){ return cell(mOf(r,m), podr, monS(m)); }).join('')
        +cell(mOf(r,cur), podr, monS(cur)+' · идёт', 'twp-cur')
        +'<td class="num" data-l="Должны">'+debtHtml(r)+(r.debtHands!=null&&r.debt>0.004?'<span class="sub2" title="долг × 0,86 — сколько выдать на руки, чтобы закрыть">на руки '+money(r.debtHands)+'</span>':'')+'</td></tr>';
    }).join('');
    var tot=function(f){ return money(rows.reduce(function(s,r){ return s+f(r); },0)); };
    var foot=rows.length?'<tr class="twp-tot"><td data-l="Итого"><b>Итого</b><span class="sub2">'+rows.length+' чел.</span></td><td class="num" data-l="На 13.09">'+(rows.some(function(r){ return r.opening; })?tot(function(r){ return r.opening||0; }):'')+'</td>'
      +(older.length?'<td class="num" data-l="Раньше">'+tot(function(r){ var s=sumM(older.map(function(m){ return mOf(r,m); })); return s.earned+s.adj; })+'</td>':'')
      +shown.map(function(m){ return '<td class="num" data-l="'+esc(monS(m))+'">'+tot(function(r){ var x=mOf(r,m); return x.earned+x.adj; })+'<span class="sub2">погашено '+tot(function(r){ return mOf(r,m).settled; })+'</span></td>'; }).join('')
      +'<td class="num twp-cur" data-l="'+esc(monS(cur))+' · идёт">'+tot(function(r){ var x=mOf(r,cur); return x.earned+x.adj; })+'<span class="sub2">погашено '+tot(function(r){ return mOf(r,cur).settled; })+'</span></td>'
      +'<td class="num" data-l="Должны"><b>'+tot(function(r){ return r.debt||0; })+'</b></td></tr>':'';
    S.el.innerHTML=top+kp+(rows.length?'<div class="tbl-wrap fill"><table class="tbl sm mob twp">'+'<thead>'+head+'</thead><tbody>'+body+foot+'</tbody></table></div>'
      :'<div class="empty">'+(S.q||S.chip?'Никого не нашлось.':'Долгов нет. «и нулевые» — показать всех.')+'</div>')
      +(S.msg?'<div class="note bad"><div>'+esc(S.msg)+'</div></div>':'');
    hint();
  }
  function hint(){ if(window.twFitTables) try{ twFitTables(); }catch(e){} }   // растянуть реестр и поставить «?» у подсказки

  /* ── карточка человека ── */
  function dlg(){
    var bg=$('twpDlg');
    if(!bg){ bg=document.createElement('div'); bg.id='twpDlg'; bg.className='dlg-bg'; bg.style.display='none'; bg.setAttribute('role','dialog'); bg.setAttribute('aria-modal','true');
      bg.innerHTML='<div class="dlg md twp-card"></div>'; bg.addEventListener('click',function(e){ if(e.target===bg) close(); });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&bg.style.display!=='none') close(); });
      document.body.appendChild(bg); }
    return bg;
  }
  function close(){ var bg=$('twpDlg'); if(bg) bg.style.display='none'; S.pid=null; }
  function say(cls, t){ var m=$('twpMsg'); if(m) m.innerHTML=t?'<div class="note '+(cls||'')+'" style="margin:var(--s-3) 0 0"><div>'+esc(t)+'</div></div>':''; }
  var L='display:block', SM='display:block;font:var(--t-small);color:var(--muted);margin-bottom:var(--s-1)';
  var fld=function(label, html){ return '<label style="'+L+'"><span style="'+SM+'">'+label+'</span>'+html+'</label>'; };
  var grid=function(h){ return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s-2) var(--s-3);align-items:end">'+h+'</div>'; };

  function card(){
    if(S.pid===null || !S.d) return;
    var bg=dlg(), box=bg.querySelector('.dlg'), d=S.d;
    if(S.pid===''){   // выбор человека: выдача наличными, отсечка
      box.innerHTML='<h3>Сотрудник<span class="x" onclick="twPayroll.close()" title="Закрыть">×</span></h3>'
        +fld('Кому выдаём или пишем долг на 13.09','<select id="twpP" style="width:100%">'+(d.people||[]).map(function(p){ return '<option value="'+p.id+'">'+esc(p.name)+'</option>'; }).join('')+'</select>')
        +'<div class="dlg-btns"><button class="sec" onclick="twPayroll.close()">Отмена</button><button onclick="twPayroll.open(document.getElementById(\'twpP\').value)">Открыть карточку</button></div>';
      bg.style.display='flex'; return;
    }
    var r=rowsAll().filter(function(x){ return x.personId===S.pid; })[0];
    if(!r){ var p=(d.people||[]).filter(function(x){ return x.personId===S.pid||x.id===S.pid; })[0];
      r={ personId:S.pid, name:p?p.name:'Сотрудник', kind:'—', opening:0, openingNote:'', payFor:[], months:{}, payments:[], noContract:0, adjustments:0, debt:0, debtHands:null, current:{ ym:d.curYm, earned:0, settled:0, paid:0 } }; }
    var podr=isPodr(r), cur=d.curYm, prev=prevYm(cur);
    // по месяцам: остаток нарастающим — как считается долг (закрытые месяцы начисляются, выплаты гасят сразу)
    var ks=Object.keys(r.months||{}).sort(), rest=r.opening||0;
    var mrows='<tr class="twp-open"><td data-l="Месяц">Долг на 13.09.2026'+(r.openingNote?'<span class="sub2">'+esc(r.openingNote)+'</span>':'')+'</td><td class="num" data-l="Начислено">'+money(r.opening||0)+'</td><td class="num" data-l="Погашено"></td><td class="num" data-l="На руки"></td><td class="num" data-l="Остаток">'+money(rest)+'</td></tr>'
      +ks.map(function(ym){
        var m=r.months[ym], idet=ym===cur, e=r2(m.earned+m.adj);
        rest=r2(rest+(m.closed?e:0)-m.settled);
        return '<tr'+(idet?' class="twp-cur"':'')+'><td data-l="Месяц">'+esc(monY(ym))+(idet?'<span class="sub2">идёт — в долг войдёт '+dmy(nextYm(cur)+'-01')+'</span>':'')+(m.adj?'<span class="sub2">наряды '+money(m.earned)+', правка '+(m.adj>0?'+':'−')+money(Math.abs(m.adj))+'</span>':'')+'</td>'
          +'<td class="num" data-l="Начислено">'+(e?money(e):'')+'</td><td class="num" data-l="Погашено">'+(m.settled?money(m.settled):'')+'</td><td class="num" data-l="На руки">'+(m.paid?money(m.paid):'')+'</td>'
          +'<td class="num" data-l="Остаток">'+(rest< -0.004?'<span class="twp-plus">наперёд '+money(-rest)+'</span>':money(rest))+'</td></tr>';
      }).join('');
    var pays=(r.payments||[]).slice().sort(function(a,b){ return b.dateIso.localeCompare(a.dateIso); });
    var byP={}, order=[]; pays.forEach(function(p){ if(!byP[p.period]){ byP[p.period]=[]; order.push(p.period); } byP[p.period].push(p); });
    order.sort().reverse();
    var payHtml=order.length?order.map(function(per){ return '<div class="twp-pg"><div class="twp-ph">за '+esc(monY(per))+'</div>'+byP[per].map(function(p){
        return '<div class="twp-pay"><span class="twp-pd">'+dmy(p.dateIso)+'</span><b>'+money(p.sum)+'</b><span class="pill '+(p.how==='наличные'?'info':p.how==='банк'?'mute':'warn')+'">'+esc(p.how)+'</span>'
          +(podr&&Math.abs(p.settled-p.sum)>0.004?'<span class="muted">погасила '+money(p.settled)+'</span>':'')+'<span class="muted twp-pn">'+esc([p.wallet,p.note].filter(Boolean).join(' · '))+'</span></div>'; }).join('')+'</div>'; }).join('')
      :'<div class="muted">Выплат с 13.09 нет.</div>';
    var wallets=(d.wallets||[]).filter(function(w){ return w.isCash; }), defW=(wallets.filter(function(w){ return /Миронов/.test(w.name); })[0]||wallets[0]||{}).id;
    var cashSum=r.debt>0.004?(r.debtHands!=null?r.debtHands:r.debt):'';
    var ymOpts=function(sel){ var a=ks.slice(); if(a.indexOf(cur)<0) a.push(cur); if(a.indexOf(prev)<0) a.push(prev); a.sort().reverse(); return a.map(function(y){ return '<option value="'+y+'"'+(y===sel?' selected':'')+'>'+esc(monY(y))+'</option>'; }).join(''); };
    var formula=podr?'Подряд: начислено — наряды до налогов; выплата гасит долг ÷ 0,86 (подоходный 13 % и пенсионный 1 % удерживаем мы), на руки человек получает 86 %.'
      :/^штат/.test(r.kind)?'Штат: на руки — сумма наряда (налоги сверху платим мы), выплата гасит долг один к одному.'
      :'Вид не указан — считается как штат (один к одному). Укажите вид ниже или заключите договор в «Кадрах».';
    var kindBlk=noCon(r)&&!/^штат$/.test(r.kind)
      ? fld('Вид, пока нет договора (то же поле — в карточке «Кадров»)','<select id="twpKind" style="width:100%" onchange="twPayroll._kind(this.value)"><option value="">не указан — один к одному</option><option value="civil_work"'+(podr?' selected':'')+'>подряд — выплата гасит ÷ 0,86</option><option value="employment"'+(/^штат/.test(r.kind)?' selected':'')+'>штат — один к одному</option></select>')
      : '<div class="muted" style="font:var(--t-small)">Вид — по договору в «Кадрах»: <b>'+esc(r.kind)+'</b></div>';
    box.innerHTML='<h3>'+esc(r.name)+' <span class="pill '+(podr?'info':'mute')+'">'+esc(r.kind==='—'?'вид не указан':r.kind)+'</span><span class="x" onclick="twPayroll.close()" title="Закрыть" aria-label="Закрыть">×</span></h3>'
      +'<p class="twp-f">'+esc(formula)+'</p>'
      +'<div class="kpis twp-k"><span class="k">Должны '+debtHtml(r)+'</span>'
        +(r.debtHands!=null&&r.debt>0.004?'<span class="k" title="долг × 0,86">выдать на руки, чтобы закрыть <b>'+money(r.debtHands)+'</b></span>':'')
        +'<span class="k">'+esc(mon(cur))+' копится <b>'+money((r.current||{}).earned)+'</b></span>'
        +(r.payFor&&r.payFor.length?'<span class="k">платим за него: '+esc(r.payFor.join(', '))+'</span>':'')+'</div>'
      +'<div class="tbl-wrap"><table class="tbl sm mob twp-m"><thead><tr><th>Месяц</th><th class="num">Начислено</th><th class="num" title="'+(podr?'выплачено ÷ 0,86':'= выплачено')+'">Погашено</th><th class="num">На руки</th><th class="num">Остаток</th></tr></thead><tbody>'+mrows+'</tbody></table></div>'
      +'<div class="sect">Выплаты с 13.09</div>'+payHtml
      +'<details class="twp-d"'+(S.open==='cash'?' open':'')+' ontoggle="if(this.open)twPayroll._sec(\'cash\')"><summary>Выдать наличными</summary>'
        +grid(fld('Кошелёк','<select id="twpW" style="width:100%">'+wallets.map(function(w){ return '<option value="'+w.id+'"'+(w.id===defW?' selected':'')+'>'+esc(w.name)+'</option>'; }).join('')+'</select>')
          +fld('Дата','<input id="twpD" type="date" value="'+esc(d.today||'')+'" style="width:100%">')
          +fld('Сумма на руки','<input id="twpS" inputmode="decimal" value="'+esc(cashSum===''?'':String(cashSum).replace('.',','))+'" style="width:100%">')
          +fld('За месяц','<select id="twpY" style="width:100%">'+ymOpts(prev)+'</select>')
          +fld('Отдел','<select id="twpDep" style="width:100%"><option>рабочие</option><option>администрация</option><option>коммерческий отдел</option></select>')
          +fld('За что','<input id="twpN" value="наличными" style="width:100%">'))
        +(podr?'<div class="muted" style="font:var(--t-small);margin-top:var(--s-2)">У подрядчика выдача гасит долг ÷ 0,86: '+'выдали 86 — погашено 100.</div>':'')
        +'<div class="dlg-btns" style="justify-content:flex-start;margin-top:var(--s-3)"><button onclick="twPayroll._cash()">Выдано</button></div></details>'
      +'<details class="twp-d"'+(S.open==='open'?' open':'')+' ontoggle="if(this.open)twPayroll._sec(\'open\')"><summary>Долг на 13.09.2026 · '+money(r.opening||0)+'</summary>'
        +grid(fld('Сумма до налогов','<input id="twpO" inputmode="decimal" value="'+esc(r.opening?String(r.opening).replace('.',','):'')+'" style="width:100%">')+fld('Примечание','<input id="twpON" value="'+esc(r.openingNote||'')+'" style="width:100%">'))
        +'<div class="dlg-btns" style="justify-content:flex-start;margin-top:var(--s-3)"><button class="sec" onclick="twPayroll._open(false)">Сохранить</button>'+(r.opening||r.openingNote?'<button class="danger sec" onclick="twPayroll._open(true)">Снять отсечку</button>':'')+'</div></details>'
      +'<details class="twp-d"'+(S.open==='kind'?' open':'')+' ontoggle="if(this.open)twPayroll._sec(\'kind\')"><summary>Вид и способ оплаты</summary>'+kindBlk
        +'<label style="'+L+';margin-top:var(--s-3)"><input type="checkbox"'+(r.salaried?' checked':'')+' onchange="twPayroll._sal(this.checked)"> оплата по окладу — наряды не основа, долг по нарядам не считать</label></details>'
      +(S.o.routes.adjust?'<details class="twp-d"'+(S.open==='adj'?' open':'')+' ontoggle="if(this.open)twPayroll._sec(\'adj\')"><summary>Правка итога месяца</summary>'
        +grid(fld('Месяц','<select id="twpAY" style="width:100%" onchange="twPayroll._adjFill()">'+ymOpts(prev)+'</select>')+fld('Итог месяца до налогов','<input id="twpAT" inputmode="decimal" style="width:100%">')+fld('Причина','<input id="twpAN" placeholder="например, доплата за выходной" style="width:100%">'))
        +'<div class="dlg-btns" style="justify-content:flex-start;margin-top:var(--s-3)"><button class="sec" onclick="twPayroll._adj()">Записать правку</button></div></details>':'')
      +'<div id="twpMsg"></div><div class="dlg-btns"><button class="sec" onclick="twPayroll.close()">Закрыть</button></div>';
    bg.style.display='flex';
    if(S.o.routes.adjust) adjFill();
  }
  function curRow(){ return rowsAll().filter(function(x){ return x.personId===S.pid; })[0]; }
  function adjFill(){ var y=$('twpAY'), t=$('twpAT'); if(!y||!t) return; var r=curRow(), m=r?mOf(r,y.value):null; t.value=m?String(r2(m.earned+m.adj)).replace('.',','):''; }

  window.twPayroll={
    mount:function(el, o){ S.el=el; S.o=o; if(S.d) draw(); else load(); },
    reload:function(){ return load(); },
    open:function(pid){ S.pid=pid==null?'':String(pid); S.open=''; card(); },
    close:close,
    _q:function(v){ S.q=String(v||'').trim().toLowerCase(); draw(); var i=S.el.querySelector('input[type=search]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },
    _chip:function(c){ S.chip=c; draw(); },
    _all:function(v){ S.all=!!v; draw(); },
    _sec:function(s){ S.open=s; },
    _adjFill:adjFill,
    _cash:function(){ var sum=num($('twpS').value); if(!(sum>0)){ say('warn','Сумма выдачи — больше нуля.'); return; }
      post({ vapi:S.o.routes.cash, key:key(), data:JSON.stringify({ personId:S.pid, sum:sum, walletId:$('twpW').value, dateIso:$('twpD').value, period:$('twpY').value, dept:$('twpDep').value, note:$('twpN').value }) }, 'Выдача записана: '+money(sum)+'.'); },
    _open:function(remove){ var q={ vapi:S.o.routes.set, person:S.pid, data:JSON.stringify(remove?{ remove:true }:{ opening:$('twpO').value, note:$('twpON').value }) }; post(q, remove?'Отсечка снята.':'Долг на 13.09 сохранён.'); },
    _kind:function(k){ post({ vapi:S.o.routes.set, person:S.pid, data:JSON.stringify({ kind:k }) }, 'Вид сохранён — он же в карточке «Кадров». Договор, когда появится, главнее.'); },
    _sal:function(on){ post({ vapi:S.o.routes.set, person:S.pid, data:JSON.stringify({ salaried:!!on }) }, on?'Отмечено: оплата по окладу.':'Долг снова считается по нарядам.'); },
    _adj:function(){ var t=$('twpAT').value, n=$('twpAN').value.trim(); if(n.length<3){ say('warn','Напишите причину правки.'); return; }
      post({ vapi:S.o.routes.adjust, data:JSON.stringify({ personId:S.pid, ym:$('twpAY').value, target:t, note:n }) }, 'Правка записана.'); }
  };
})();
