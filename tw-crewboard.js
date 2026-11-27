/* Доска расстановки «человек × время» (владелец 22.11.2026): строка — человек из табеля дня, по горизонтали — время,
   блок — работа. Блок тянут мышью (по времени и на другого человека), растягивают за правый край; людей переставляют за ⋮⋮.
   Сервер (prohub src/production/crewBoard.ts): crewboard — день, crewtask / crewtaskdel — один блок, crewsort — порядок людей,
   crewrefs — работы всех открытых заказов (поиск и подсказки считаются здесь, без запроса на каждую букву), crewcarry — недоделанное.
   Запретов нет: «перед операцией нечего брать» — только пометка ⚠. На телефоне блоки не тянут — тап открывает окно с теми же полями.
   twCrewBoard.mount(el, { api, post, date:'гггг-мм-дд', actions:<элемент для кнопок> }); twCrewBoard.setDate(d). */
(function(){
  var S={ el:null, o:null, date:'', d:null, refs:null, refsAt:0, undo:[], msg:'', msgT:0, drag:null, dlg:null, touch:false, busy:0, clip:null, pt:null, rev:0, pollT:0, polling:0, actAt:0, lastX:0, lastY:0 };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var lc=function(s){ return String(s==null?'':s).trim().toLowerCase().replace(/ё/g,'е'); };
  var num=function(v){ return Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'))||0; };
  var n1=function(x){ return (Math.round(x*10)/10).toLocaleString('ru-RU'); };
  var money=function(x){ return (Math.round(x*100)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var qtyS=function(x){ return (Math.round(x*100)/100).toLocaleString('ru-RU'); };
  var hm=function(m){ m=Math.round(m); return (Math.floor(m/60)%24)+':'+('0'+(m%60)).slice(-2); };
  var hm2=function(m){ return ('0'+(Math.floor(m/60)%24)).slice(-2)+':'+('0'+(m%60)).slice(-2); };
  var durS=function(m){ var h=Math.floor(m/60), r=m%60; return (h?h+' ч':'')+(h&&r?' ':'')+(r||!h?r+' мин':''); };
  var dmy=function(iso){ return iso?iso.slice(8,10)+'.'+iso.slice(5,7):''; };
  var ruD=function(iso){ return iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4); };
  var shIco=function(s){ return s==='ночь'?'🌙':(s==='2 смена'?'🌇':''); };
  // «Иванов Иван Иванович» → «Иванов И.»: строка узкая, полное имя — в подсказке
  var shortName=function(n){ var p=String(n).trim().split(/\s+/); return p.length>1?p[0]+' '+p[1].charAt(0)+'.':n; };
  var store=function(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} return null; };
  var $=function(id){ return document.getElementById(id); };
  var narrow=function(){ return window.innerWidth<=640; };
  // «подробно» — текст блоков переносится, строки растут под него; выбор помнится в этом браузере, на телефоне подробный вид — сразу
  function isDet(){ var v=store('tw_cb_det'); return v==null?narrow():v==='1'; }
  function closest(t,cls){ while(t&&t!==document){ if(t.classList&&t.classList.contains(cls)) return t; t=t.parentNode; } return null; }

  /* ── данные ── */
  function cfg(){ return (S.d&&S.d.cfg)||{ from:480, to:1080, snap:15, efficiency:0.7, hourRate:15 }; }
  function people(){ return (S.d&&S.d.people)||[]; }
  function person(name){ var ps=people(); for(var i=0;i<ps.length;i++) if(ps[i].name===name) return ps[i]; return null; }
  function taskBy(id){ var ps=people(); for(var i=0;i<ps.length;i++) for(var j=0;j<ps[i].tasks.length;j++) if(ps[i].tasks[j].id===id) return { p:ps[i], t:ps[i].tasks[j] }; return null; }
  function load(keepMsg){
    S.rev++;
    if(!keepMsg) S.msg='';
    return S.o.api({ vapi:'crewboard', date:S.date }).then(function(r){
      if(!r||!r.ok){ S.d=null; S.el.innerHTML='<div class="center err">'+esc((r&&r.error)||'Не загрузилось')+'</div>'; return; }
      S.d=r; draw(); if(!S.refs||Date.now()-S.refsAt>90000) loadRefs();
    }).catch(function(){ S.el.innerHTML='<div class="center err">Связь оборвалась. <a href="javascript:void(0)" onclick="twCrewBoard.reload()">Повторить</a></div>'; });
  }
  function loadRefs(){
    return S.o.api({ vapi:'crewrefs' }).then(function(r){ if(r&&r.ok){ S.refs=r.rows||[]; S.refsAt=Date.now(); draw(); if(S.dlg&&S.dlg.kind==='add') dlgList(); } }).catch(function(){});
  }
  // ответ записи несёт строки затронутых людей — подменяем их на месте, без перезагрузки дня
  function merge(rows){
    (rows||[]).forEach(function(nr){ var p=person(nr.name); if(p){ p.tasks=nr.tasks; p.sent=nr.sent; p.status=nr.status; p.shift=nr.shift; } });
    draw();
  }
  /* ── чужие правки: день перечитывается раз в 3 с и перерисовывается, только если на сервере он уже другой ── */
  var POLL_MS=3000;
  function dayKey(d){ return JSON.stringify([d.people,d.rest,d.cfg,d.today]); }
  // не трогаем экран, пока человек тянет блок, держит открытое окно, идёт запись или печать, а также когда доску не видно
  function idle(){ return !!(S.d&&!S.busy&&!S.drag&&!S.dlg&&!S.pr&&document.visibilityState!=='hidden'&&S.el.offsetWidth>0&&S.el.querySelector('.cb')); }
  function poll(){
    clearTimeout(S.pollT); S.pollT=setTimeout(poll,POLL_MS);
    if(S.polling||!idle()) return;
    var rev=S.rev, date=S.date; S.polling=1;
    S.o.api({ vapi:'crewboard', date:date }).then(function(r){
      S.polling=0;
      // пока шёл запрос, здесь что-то сделали сами — ответ мог быть снят до нашей записи; возьмём следующий
      if(!r||!r.ok||rev!==S.rev||date!==S.date||!idle()||dayKey(r)===dayKey(S.d)) return;
      S.undo=rebase(S.undo,S.date,people(),r.people||[]); S.d=r; draw();
    }).catch(function(){ S.polling=0; });
  }
  // «↶» приводит день к снимку. Чужую правку вносим и в снимки, иначе отмена своего действия откатила бы работу второго человека.
  // ponytail: чужая правка, приехавшая в ответе на нашу же запись (та же строка, окно до 3 с), в снимки не попадает — нужны версии строк, если станет мешать
  var UF=['start','dur','qty','title','manual','op','detail','order','model','eq','rate'];
  function taskKey(name,t){ return name+'|'+UF.map(function(f){ return t[f]; }).join('|'); }
  function rebase(undo,date,was,now){
    if(!undo.length) return undo;
    var o={}, nowIds={}, put={}, nm=function(p){ return p.name; }, names=now.map(nm), order=was.map(nm).join('|')!==names.join('|');
    was.forEach(function(p){ p.tasks.forEach(function(t){ o[t.id]=taskKey(p.name,t); }); });
    now.forEach(function(p){ p.tasks.forEach(function(t){ nowIds[t.id]=1; if(o[t.id]!==taskKey(p.name,t)) put[t.id]={ name:p.name, t:t }; }); });
    return undo.map(function(raw){
      var b=JSON.parse(raw), by={}; if(b.date!==date) return raw;
      // убираем из снимка то, что второй человек удалил или изменил; изменённое и добавленное кладём в нынешнем виде
      b.people.forEach(function(p){ by[p.name]=p; p.tasks=p.tasks.filter(function(t){ return !put[t.id]&&(nowIds[t.id]||!o[t.id]); }); });
      Object.keys(put).forEach(function(id){ var w=put[id], p=by[w.name]; if(!p){ p=by[w.name]={ name:w.name, tasks:[] }; b.people.push(p); } p.tasks.push(w.t); });
      if(order) b.people=names.map(function(n){ return by[n]||{ name:n, tasks:[] }; });
      return JSON.stringify(b);
    });
  }
  function say(t,err){ S.msg=t?('<span class="'+(err?'err':'ok')+'">'+t+'</span>'):''; clearTimeout(S.msgT); if(t&&!err) S.msgT=setTimeout(function(){ S.msg=''; drawMsg(); },7000); drawMsg(); }
  function send(p, ok, fail){
    S.busy++; S.rev++;
    return S.o.post(p).then(function(r){
      S.busy--;
      if(!r||!r.ok){ if(fail){ fail((r&&r.error)||'не сохранилось'); return null; } say(esc((r&&r.error)||'не сохранилось'),1); return load(true).then(function(){ return null; }); }
      if(ok) ok(r); return r;
    }).catch(function(){ S.busy--; say('Связь оборвалась — изменение не сохранено',1); return load(true).then(function(){ return null; }); });
  }

  /* ── шкала: настройка дня, «＋ час» с краёв (запоминается на дату в этом браузере) и всё, что уже стоит ── */
  function ext(){ var v=String(store('tw_cb_ext_'+S.date)||'0,0').split(','); return { l:Math.max(0,+v[0]||0), r:Math.max(0,+v[1]||0) }; }
  function scale(){
    var c=cfg(), e=ext(), a=c.from-e.l*60, b=c.to+e.r*60;
    people().forEach(function(p){ p.tasks.forEach(function(t){ a=Math.min(a,Math.floor(t.start/60)*60); b=Math.max(b,Math.ceil((t.start+t.dur)/60)*60); }); });
    a=Math.max(0,a); return { from:a, to:b, span:b-a, hours:(b-a)/60 };
  }
  function addHour(side){ var e=ext(); if(side==='l') e.l++; else e.r++; store('tw_cb_ext_'+S.date,e.l+','+e.r); draw(); }

  /* ── подсказки по цепочке (без запретов) ── */
  function refOf(t){
    if(!t.op||!S.refs) return null;
    for(var i=0;i<S.refs.length;i++){ var r=S.refs[i];
      if(r.order!==t.order||lc(r.op)!==lc(t.op)) continue;
      if(r.level==='изделие'?(t.model&&lc(r.model)===lc(t.model)&&lc(r.eq)===lc(t.eq)):lc(r.detail)===lc(t.detail)) return r; }
    return null;
  }
  function hintOf(t){
    var r=refOf(t); if(!r) return null;
    var prevQty=0, who=[];
    if(r.prev) people().forEach(function(p){ p.tasks.forEach(function(x){
      if(x.id!==t.id&&x.order===t.order&&lc(x.detail)===lc(t.detail)&&lc(x.op)===lc(r.prev)){ prevQty+=x.qty; who.push(shortName(p.name)+' с '+hm(x.start)+(x.qty?' ('+qtyS(x.qty)+' шт)':'')); } }); });
    // у первой операции детали (упаковка фурнитуры, раскрой) перед ней ничего не «лежит»: ⚠ не ставим, сверх заказа — просто пометка
    return { ref:r, who:who, first:!r.prev, warn:!!r.prev&&t.qty>0&&t.qty>r.avail+prevQty+0.001, over:t.qty>r.left+0.001 };
  }
  function hintText(t,h){
    if(!h) return '';
    var a=[];
    if(h.warn) a.push('⚠ перед операцией лежит '+qtyS(h.ref.avail)+' из '+qtyS(t.qty)+' шт');
    else if(!h.first&&t.qty>h.ref.avail+0.001) a.push('лежит '+qtyS(h.ref.avail)+' шт, остальное даст предыдущая операция');
    if(h.ref.prev) a.push('предыдущая — «'+h.ref.prev+'»: '+(h.who.length?h.who.join(', '):'сегодня ни у кого не стоит'));
    if(h.over) a.push(h.ref.left>0?('по заказу осталось '+qtyS(h.ref.left)+' шт'+(h.first?' — остальное сверх заказа, впрок':'')):('по заказу уже сделано '+qtyS(h.ref.done)+' из '+qtyS(h.ref.need)+' — это сверх заказа'));
    return a.join(' · ');
  }
  // «откуда время»: сумма работы по расценке и темп, которым она делится
  function durWhy(qty,rate){ var c=cfg(); if(!(qty>0&&rate>0)) return ''; return ' · '+(Math.round(qty*rate*100)/100).toLocaleString('ru-RU')+' ₽ по расценке при '+(Math.round(c.hourRate*c.efficiency*100)/100).toLocaleString('ru-RU')+' ₽/час'; }
  // работа на n человек: доля первого и её длина — то же правило, что на сервере (crewsplit)
  function shareOf(t,n){
    var c=cfg(), free=!t.op, whole=Math.round(t.qty)===t.qty, q=free?0:(whole?Math.floor(t.qty/n)+(t.qty%n>0?1:0):Math.round(t.qty/n*1000)/1000);
    var dur=(t.manual||free)?Math.max(c.snap,Math.round(t.dur/n/c.snap)*c.snap):calcDur(q,t.rate);
    return { qty:q, dur:dur, bad:!free&&whole&&t.qty<n };
  }
  function calcDur(qty,rate){ var c=cfg(); if(!(qty>0&&rate>0)) return 60; return Math.max(c.snap,Math.round(qty*rate/(c.hourRate*c.efficiency)*60/c.snap)*c.snap); }

  // короткое название операции для узких блоков (владелец 22.11.2026): слово длиннее семи букв — первые буквы до согласной и точка
  // («Шпатлевка торцов» → «Шпатл. торцов», «Упаковка фурнитуры» → «Упак. фурн.»). Полное название — в раскрытии при наведении.
  function shortOp(name){
    return String(name||'').split(/\s+/).map(function(w){
      if(w.length<=7||/\d/.test(w)) return w;
      var c=w.slice(0,5).replace(/[аеёиоуыэюяьй]+$/i,''); return (c.length<3?w.slice(0,4):c)+'.';
    }).join(' ');
  }
  /* ── отрисовка ── */
  // цвет участка — класс палитры темы по порядку участков: в справочнике операций у раскроя и механики цвет один, блоки сливались бы
  function colorOf(g){ var s=(S.d&&S.d.sites)||[]; for(var i=0;i<s.length;i++) if(s[i].name===g) return g==='Прочее'?'':' cb-c'+(i%7); return ''; }
  function blkHtml(t,sc){
    var free=!t.op, h=hintOf(t), col=free?'':colorOf(t.group);
    var l=(t.start-sc.from)/sc.span*100, w=t.dur/sc.span*100;
    var pct=(!free&&t.qty>0&&t.done>0)?Math.min(100,Math.round(t.done/t.qty*100)):0;
    var noted=!free&&!!t.title, so=free?'':shortOp(t.op);
    return '<div class="cb-blk'+col+(free?' free':'')+(h&&h.warn?' warn':'')+(noted?' noted':'')+(pct>=100?' done':'')+'" data-id="'+esc(t.id)+'" data-k="'+esc(lc(t.order+'|'+t.detail))+'"'
      +' style="left:'+l.toFixed(3)+'%;width:'+w.toFixed(3)+'%">'
      +(free?('<span class="cb-t cb-t2">'+esc(t.title)+'</span>')
        :('<span class="cb-t"><b>'+(S.pr&&S.prCh[t.id]?'<i class="cb-ch k'+S.prCh[t.id].k+'">'+S.prCh[t.id].tag+'</i>':'')+(so!==t.op?'<span class="cb-of">'+esc(t.op)+'</span><span class="cb-os">'+esc(so)+'</span>':esc(t.op))+'</b>'+((t.model||t.detail)?'<i class="cb-sep"> · </i><span class="cb-d">'+esc(t.model||t.detail)+'</span>':'')+'</span>'
          // значок примечания — сразу после партии (владелец 22.11.2026: в правом углу блока его плохо видно); строка сжимается, значок — нет
          +'<span class="cb-s"><span class="cb-sx">'+qtyS(t.qty)+' шт'+(t.order?' · '+esc(t.order):'')+'</span>'+(t.title?'<i class="cb-nb" title="есть примечание">✎</i>':'')+(t.done>0?'<span class="cb-sx"> · сдано '+qtyS(t.done)+'</span>':'')+'</span>'
          +(t.title?'<span class="cb-note"><i>✎</i>'+esc(t.title)+'</span>':'')))
      +(pct?'<i class="cb-fill" style="width:'+pct+'%"></i>':'')+'<span class="cb-rv" title="потяните вниз или вверх — разделить работу с соседями"></span><span class="cb-rz"></span></div>';
  }
  // наряд за день (владелец 27.11.2026): '' — судить не о чем (день впереди, «не вышел», окладник, сервер ещё не отдаёт признак),
  // 'ok' — наряд сдан, 'no' — день прошёл, человек стоял в смене, наряда нет. За сегодня «нет» не пишем: наряд сдают вечером.
  function repOf(p){
    if(!S.d||!('rep' in p)||S.d.date>S.d.today||p.status==='не вышел'||p.sal) return '';
    return p.rep?'ok':(S.d.date<S.d.today?'no':'');
  }
  // Итог дня над доской (владелец 27.11.2026): план, сделано по плану, вне плана — в ₽ труда. Процент — от всего плана дня (владелец: 295 из 764 должно читаться как 39 %);
  // сколько плана у несдавших наряд, стоит рядом отдельным числом — про него неизвестно, сделан ли. Сегодня — «на сейчас» и только когда наряды уже есть; в будущих днях строки нет.
  function sumHtml(ps){
    var d=S.d; if(S.pr||!ps.length||!('day' in ps[0])||d.date>d.today) return '';
    var r0=function(x){ return Math.round(x).toLocaleString('ru-RU'); };
    var P=0,Pm=0,H=0,F=0,E=0,U=0,Pu=0,T=0;
    ps.forEach(function(p){ var y=p.day; P+=y.plan; p.tasks.forEach(function(t){ if(!t.op) T++; });
      if(p.rep){ Pm+=y.plan; H+=y.hit; F+=y.fact; E+=y.extra; }
      else if(y.plan>0&&p.status!=='не вышел'){ U++; Pu+=y.plan; } });
    var now=d.date===d.today; if(now?!(F>0):!(P>0||F>0)) return '';
    var n=narrow(), k=function(l,v,t){ return '<span class="k" title="'+t+'">'+l+' <b>'+v+'</b></span>'; };
    return '<div class="cb-sum"><span class="k">'+(now?'Сегодня на сейчас':'Итог дня')+'</span>'
      +k('план',r0(P)+' ₽','работа с операцией в плане на всех, по расценкам'+(T?'; ещё '+T+' блоков текстом — в сумму не входят':''))
      +k(n?'по плану':'сделано по плану',r0(H)+' ₽'+(P>0?' <i>'+Math.round(H/P*100)+' %</i>':''),'сдано нарядами из того, что стояло в плане у этого человека на этот день. Процент — от всего плана дня'+(U&&Pm>0?'; от плана тех, кто сдал наряд ('+r0(Pm)+' ₽), — '+Math.round(H/Pm*100)+' %':''))
      +k('вне плана',r0(E)+' ₽','сдано нарядами, чего в плане у человека не было, и сверх количества в плане. Всего сдано за день: '+r0(F)+' ₽')
      +(U?k(n?'без наряда':'план без наряда',r0(Pu)+' ₽ <i>'+U+' чел</i>','у этих людей в плане работа с операцией, а наряда за день нет — сделано или нет, неизвестно'):'')+'</div>';
  }
  function rowHtml(p,sc){
    var c=cfg(), cap=(c.to-c.from)/60, busy=0, rub=0; p.tasks.forEach(function(t){ busy+=t.dur; rub+=t.qty*t.rate; }); busy=busy/60;
    var cls=busy>cap+0.01?' over':(busy>=cap*0.9?' full':'');
    // на листе линии часов — настоящие элементы: фоновая сетка (градиент) в PDF ложится размытыми полосами не на своих местах
    var rp=S.pr?'':repOf(p), nar=narrow();
    var repT=p.sal&&!p.rep?' · на окладе — наряд не обязателен':(rp==='ok'?' · наряд за день: '+p.rep.n+' стр. на '+money(p.rep.rub)+' ₽'+(p.day?' · план '+money(p.day.plan)+' ₽, по плану сделано '+money(p.day.hit)+' ₽, вне плана '+money(p.day.extra)+' ₽':''):(rp==='no'?' · 🔴 нет наряда за этот день (не работал — отметьте в табеле «не вышел»)':''));
    var hl='', i; if(S.pr) for(i=1;i<sc.hours;i++) hl+='<i class="cb-hl" style="left:'+(i/sc.hours*100).toFixed(3)+'%"></i>';
    return '<div class="cb-row'+(p.status==='не вышел'?' off':'')+(!S.pr&&S.find===p.name?' find':'')+'" data-w="'+esc(p.name)+'">'
      +'<div class="cb-name"><span class="cb-grip" title="перетащите, чтобы переставить человека">⋮⋮</span>'
      +'<span class="cb-nm" title="'+esc(p.name)+(p.home?' · участок: '+esc(p.home):'')+(p.sent?' · задание отправлено':'')+repT+'">'+(rp==='no'?'<i class="cb-nr"></i>':'')+shIco(p.shift)+esc(nar?shortName(p.name):p.name)+(p.sent&&!nar?' <span class="cb-sent">✓</span>':'')+'</span>'
      +(rub>0?'<span class="cb-rub" title="заработает по расценкам, если сделает всё, что стоит в плане: '+money(rub)+' ₽ (до налогов, без премий)">'+Math.round(rub).toLocaleString('ru-RU')+' ₽</span>':'')
      +'<span class="cb-ld'+cls+'" title="занято часов из '+n1(cap)+'">'+(busy?n1(busy):'—')+'<i>/'+n1(cap)+'</i></span>'
      // на телефоне «✓ отправлено» — у правого края второй строки (место задаёт тема): в строке имени оно съедало место у фамилии
      +(p.sent&&nar?'<span class="cb-sent" title="задание отправлено">✓</span>':'')+'</div>'
      +'<div class="cb-lane" data-w="'+esc(p.name)+'">'+hl+p.tasks.map(function(t){ return blkHtml(t,sc); }).join('')+'</div></div>';
  }
  function draw(){
    if(!S.d) return;
    // найденного в этом дне нет (сменили дату, убрали из смены) — поле поиска очищается, а не показывает имя без строки
    if(S.find&&!person(S.find)) S.find='';
    var sc=scale(), c=cfg(), ps=people(), cap=(c.to-c.from)/60, tot=0;
    var rubAll=0; ps.forEach(function(p){ p.tasks.forEach(function(t){ tot+=t.dur; rubAll+=t.qty*t.rate; }); });
    var hours=''; for(var h=sc.from;h<sc.to;h+=60) hours+='<span class="cb-h" style="left:'+((h-sc.from)/sc.span*100).toFixed(3)+'%;width:'+(60/sc.span*100).toFixed(3)+'%">'+(Math.floor(h/60)%24)+'</span>';
    var nf=nowFrac(sc), now=nf<0?'':'<i class="cb-now" style="left:'+nowLeft(nf)+'"></i>';
    if(S.pr) printChains();
    var noRep=S.pr?[]:ps.filter(function(p){ return repOf(p)==='no'; }).map(function(p){ return p.name; });
    var legend=((S.d.sites)||[]).filter(function(s){ return s.name!=='Прочее'; }).map(function(s){ return '<span class="cb-lg'+colorOf(s.name)+'">'+esc(s.name)+'</span>'; }).join('');
    var sc0=$('cbWrap'), keep=sc0?{ x:sc0.scrollLeft, y:sc0.scrollTop }:null, py=window.pageYOffset;
    if(sc0) touched(sc0);
    // высоту держим на время перерисовки: пока строки не домерены, страница короче — Safari сразу поджимает прокрутку, и экран прыгал в начало (владелец 27.11.2026)
    S.el.style.minHeight=S.el.offsetHeight+'px';
    S.el.innerHTML='<div class="cb-msg" id="cbMsg">'+msgHtml()+'</div>'+sumHtml(ps)
      +'<div class="note hint'+(S.help?' show':'')+'" data-hb="1">Щёлкните по пустому месту в строке — добавить работу: начните писать (деталь, операция, заказ) и выберите из списка, или просто впишите текст и нажмите Enter. '
      +'Блок тянется мышью — по времени и на другого человека; за правый край растягивается. К работе можно дописать примечание — оно видно на блоке (✎), в раскрытии при наведении и уходит рабочему вместе с заданием. Скопировать блок: наведите на него и нажмите Ctrl+C (или щёлкните по блоку → «⧉ Копировать»), затем щёлкните по месту, куда вставить, — у другого человека, на другое время или в другом дне; Esc — убрать из буфера. Назначили не ту деталь — щёлкните по блоку и нажмите «✎ заменить»: блок, время и человек останутся. Потяните нижний край блока на соседние строки — работа разделится между этими людьми, количество и время поровну. Людей переставляют за ⋮⋮. Длина блока считается из количества и расценки при темпе '
      +String(Math.round(c.efficiency*100))+' % от '+String(c.hourRate).replace('.',',')+' ₽/час; растянутый вручную блок помнит свою длину. ⚠ — перед операцией сейчас лежит меньше, чем задано (это подсказка, а не запрет). Наведите на блок — подсветится цепочка этой детали на день: номера шагов по техпорядку, синим — что делается до, серым — после, красным — шаг, стоящий по времени не на своём месте; внизу та же цепочка словами. Если текст в блок не помещается, наведите на него — блок раскроется и покажет текст целиком; кнопка «Компактно / Подробно» переносит текст задач в блоках целиком. Зелёная полоска — сколько уже сдано нарядами. Сумма в ₽ у человека — сколько он заработает по расценкам, если сделает весь план (до налогов, без премий).</div>'
      +(ps.length?'':'<div class="empty">На '+dmy(S.d.date)+' в табеле никого нет — добавьте людей кнопкой «＋ Человек».</div>')
      +(S.pr?'<div class="cb-ph"><b>План на '+ruD(S.d.date)+'</b> ('+WD[new Date(S.d.date+'T00:00:00').getDay()]+') · '+ps.length+' чел · занято '+n1(tot/60)+' из '+n1(ps.length*cap)+' ч</div>':'')
      +'<div class="cb-wrap'+(S.pr?' pr':(narrow()?' tbl-wrap':' tbl-wrap fill'))+'" id="cbWrap"><div class="cb'+(S.pr||isDet()?' det':'')+(S.clip&&!S.pr?' paste':'')+'" style="--cb-hours:'+sc.hours+(S.nameW?';--cb-name:'+S.nameW+'px':'')+'">'
      +'<div class="cb-head"><div class="cb-name cb-corner"><b>'+ps.length+' чел</b>'+(noRep.length?'<span class="cb-nrc" title="нет наряда за этот день: '+esc(noRep.join(', '))+'"><i class="cb-nr"></i>'+noRep.length+'</span>':'')+(rubAll>0?'<span class="cb-rub" title="работы в плане по расценкам на всех: '+money(rubAll)+' ₽">'+Math.round(rubAll).toLocaleString('ru-RU')+' ₽</span>':'')+'<span class="cb-ld">'+n1(tot/60)+'<i>/'+n1(ps.length*cap)+' ч</i></span></div>'
      +'<div class="cb-lane cb-hours"><button class="cb-add l" title="добавить час раньше" data-add="l">＋</button>'+hours+'<button class="cb-add r" title="добавить час позже" data-add="r">＋</button></div></div>'
      +ps.map(function(p){ return rowHtml(p,sc); }).join('')+now+'</div></div>'
      +'<div class="cb-foot"><span class="cb-legend" id="cbLegend">'+legend+'<span class="cb-lg free">текстом</span>'+(noRep.length?'<span class="cb-nrc"><i class="cb-nr"></i>нет наряда</span>':'')+(S.pr&&S.prChN?'<span class="cb-chl"><i class="cb-ch k0">А</i><i class="cb-ch k0">А</i> — одинаковый кружок: одна деталь идёт по операциям</span>':'')+'</span><span class="cb-chain" id="cbChain" hidden></span></div>';
    S.over=null; hideTip();
    if(S.pr) fitPrint(); else { fitNames(); fitShort(); fitRows(); }
    drawActions(); fitBox();
    var w=$('cbWrap'); if(keep){ w.scrollLeft=keep.x; w.scrollTop=keep.y; }
    S.el.style.minHeight=''; if(window.pageYOffset!==py) window.scrollTo(0,py);
    S.lastX=w.scrollLeft; S.lastY=w.scrollTop;
    // день открыли заново — сразу к линии «сейчас»; при перерисовке — только если экран давно не трогали
    follow(!keep); stick();
    if(window.twFit) try{ twFit(); }catch(e){}
  }
  /* ── телефон (владелец 27.11.2026): доска занимает остаток экрана и прокручивается внутри — шкала часов и имена всегда на месте;
     линия «сейчас» двигается раз в полминуты, и доска идёт за ней, если экран не трогали полторы минуты (иначе того, кто смотрит план
     на вечер, отбрасывало бы назад). Линия стоит на трети видимой шкалы: немного прошедшего и больше предстоящего. ── */
  var FOLLOW_MS=90000;
  function nowFrac(sc){ if(!S.d||S.d.date!==S.d.today) return -1; var d=new Date(), m=d.getHours()*60+d.getMinutes(); return (m>sc.from&&m<sc.to)?(m-sc.from)/sc.span:-1; }
  function nowLeft(f){ return 'calc(var(--cb-name) + (100% - var(--cb-name)) * '+f.toFixed(4)+')'; }
  function fitBox(){
    var w=$('cbWrap'); if(!w||S.pr||!narrow()) return;
    w.style.maxHeight='none';
    // что под доской (легенда, поля страницы) от её высоты не зависит
    var r=w.getBoundingClientRect(), below=Math.min(120,Math.max(8,Math.round(document.body.getBoundingClientRect().bottom-r.bottom)));
    w.style.maxHeight=Math.max(240,window.innerHeight-(r.top+window.pageYOffset)-below)+'px';
  }
  function follow(force){
    var w=$('cbWrap'), cb=w&&w.querySelector('.cb'), nm=cb&&cb.querySelector('.cb-name'); if(!nm||S.pr||!narrow()) return;
    touched(w);
    var f=nowFrac(scale()); if(f<0||(!force&&Date.now()-S.actAt<FOLLOW_MS)) return;
    var name=nm.offsetWidth;
    w.scrollLeft=Math.max(0,Math.round((cb.offsetWidth-name)*f-(w.clientWidth-name)*0.33)); S.lastX=w.scrollLeft; stick();
  }
  function nowTick(){
    if(!idle()) return;
    var f=nowFrac(scale()), ln=S.el.querySelector('.cb-now');
    // линия появилась (началась смена) или ушла за край шкалы — перерисовать; иначе просто сдвинуть
    if((f>=0)!==!!ln){ draw(); return; }
    if(ln) ln.style.left=nowLeft(f);
    follow();
  }
  // работа началась левее видимой шкалы — её текст едет за левым краем доски: иначе там, где доска стоит на «сейчас»,
  // от идущих работ видны одни цветные полосы без подписи. Сдвиг — transform: переносы текста и высоты строк не меняются.
  function stick(){
    var w=$('cbWrap'); S.stickT=0; if(!w||S.pr) return;
    var x=w.scrollLeft, bl=w.querySelectorAll('.cb-row .cb-blk'), v=[], i;
    for(i=0;i<bl.length;i++){ var d=x-bl[i].offsetLeft; v.push(d>0?Math.min(d,Math.max(0,bl[i].offsetWidth-48)):0); }
    for(i=0;i<bl.length;i++) if((bl[i]._sx||0)!==v[i]){ bl[i]._sx=v[i]; bl[i].style.setProperty('--sx',v[i]+'px'); }
  }
  // своя прокрутка и касания — «экран трогали»; прокрутку, которую поставили сами (возврат после перерисовки, шаг за линией), не считаем
  function onScroll(e){
    hideTip(); var w=$('cbWrap'); if(!w||e.target!==w) return;
    // не rAF: в скрытом iframe оболочки он не срабатывает, и метка «уже запланировано» осталась бы навсегда
    if(!S.stickT) S.stickT=setTimeout(stick,16);
    touched(w);
  }
  // событие прокрутки приходит не всегда (страница в фоне не рисует кадры) — поэтому то же сравнение делаем перед перерисовкой и перед шагом за линией
  function touched(w){
    if(Math.abs(w.scrollLeft-S.lastX)>1||Math.abs(w.scrollTop-S.lastY)>1) S.actAt=Date.now();
    S.lastX=w.scrollLeft; S.lastY=w.scrollTop;
  }
  // колонка имён — по самому длинному имени: фамилии должны читаться целиком (на телефоне колонка узкая, имя — в подсказке)
  function fitNames(){
    var cb=S.el.querySelector('.cb'); if(!cb||window.innerWidth<=640) return;
    var nm=cb.querySelectorAll('.cb-row .cb-nm'), over=0, i;
    for(i=0;i<nm.length;i++) over=Math.max(over,nm[i].scrollWidth-nm[i].clientWidth);
    if(over<=0) return;
    S.nameW=Math.min(360,cb.querySelector('.cb-row .cb-name').offsetWidth+over+4); cb.style.setProperty('--cb-name',S.nameW+'px');
  }
  // узкий блок — короткое название операции: в компактном виде — если строка не помещается, в подробном — если блок уже ~1,5 часа,
  // чтобы длинное слово не рвалось по буквам
  function fitShort(){
    var cb=S.el.querySelector('.cb'); if(!cb) return;
    var det=cb.classList.contains('det'), bl=cb.querySelectorAll('.cb-row .cb-blk'), i;
    for(i=0;i<bl.length;i++){ var b=bl[i], t=b.querySelector('.cb-t');
      // на листе совсем узкий блок (четверть часа) текст не переносит — иначе он встаёт столбиком по букве и раздувает строку на пол-листа
      if(S.pr){ if(b.clientWidth<70) b.classList.add('nar'); else b.classList.remove('nar'); }
      if(!t||!b.querySelector('.cb-os')) continue;
      b.classList.remove('short');
      if(det?b.clientWidth<150:t.scrollWidth>t.clientWidth+1) b.classList.add('short'); }
  }
  // подробный вид: строка человека — по самому высокому блоку (текст перенесён), но не выше шести строк текста
  function fitRows(){
    var cb=S.el.querySelector('.cb.det'); if(!cb) return;
    var rows=cb.querySelectorAll('.cb-row'), i, j;
    for(i=0;i<rows.length;i++){ var bl=rows[i].querySelectorAll('.cb-blk'), h=0; rows[i].style.height='';
      for(j=0;j<bl.length;j++) h=Math.max(h,bl[j].scrollHeight+8);
      if(h>rows[i].offsetHeight) rows[i].style.height=Math.min(h,S.pr?S.prCap:140)+'px'; }
  }
  /* ── печать (владелец 23.11.2026): подробный вид на один альбомный лист A4, во всю ширину ──
     Экранная раскладка на лист не годится: высоты строк и колонка имён посчитаны под ширину окна. Перед печатью доска перерисовывается
     под лист: ширина в пикселях задана явно (на экране и на бумаге раскладка одна и та же), масштаб подбирается так, чтобы всё встало
     на одну страницу. Лист A4 поперёк с полями 8 мм (@page в planning.html) — 281 × 194 мм ≈ 1062 × 733 px; берём с запасом. */
  var PAGE_W=1050, PAGE_H=716, WD=['вс','пн','вт','ср','чт','пт','сб'];
  function fitPrint(){
    var wrap=$('cbWrap'), cb=wrap&&wrap.querySelector('.cb'); if(!cb) return;
    var ph=S.el.querySelector('.cb-ph'), ft=S.el.querySelector('.cb-foot'), i, j;
    // колонка имён — ровно по тексту: сжимаем, чтобы scrollWidth показал настоящую ширину имени, а не растянутую ячейку
    cb.style.setProperty('--cb-name','40px');
    var ns=cb.querySelectorAll('.cb-name'), need=0;
    for(i=0;i<ns.length;i++){ var w=0, ch=ns[i].children; for(j=0;j<ch.length;j++) w+=ch[j].scrollWidth; need=Math.max(need,w); }
    cb.style.setProperty('--cb-name',(Math.ceil(need*1.06)+34)+'px');   // +6 %: на бумаге значок смены и буквы чуть шире, чем на экране
    var avail=PAGE_H-(ph?ph.offsetHeight:0)-(ft?ft.offsetHeight:0)-12;
    // Высоты строк меряем на доске чуть уже листа (−3 %), а печатаем во всю ширину: на бумаге буквы ложатся не точь-в-точь как на экране,
    // и строка, вставшая впритык, переносилась — текст блока обрезался снизу. С запасом перенос на бумаге может только исчезнуть.
    // раскладка при масштабе z: доска шириной лист ÷ z, строки — по тексту, но не выше cap (девять строк текста: один блок с длинным
    // примечанием в получасе не должен мельчить весь лист); возвращает высоту на бумаге
    var lay=function(z,cap){ S.prCap=cap||CAP; cb.style.width=Math.floor(PAGE_W/z*0.97)+'px'; fitShort(); fitRows(); return cb.offsetHeight*z; };
    // 1) самый крупный масштаб, при котором весь текст на одном листе; мельче Z0 не уменьшаем — шрифт 11 px × 0,66 ≈ 5,5 пт, дальше не прочесть;
    // 2) не встало и при Z0 — подрезаем самые высокие строки (текст перегруженных блоков), а не мельчим всё;
    // 3) людей столько, что не встаёт и так, — дожимаем масштабом: лист всё равно один.
    var Z0=0.66, CAP=120, z=1, cap=CAP, lo, hi, m;
    if(lay(1)>avail){
      if(lay(Z0)<=avail){ lo=Z0; hi=1; for(i=0;i<7;i++){ m=(lo+hi)/2; if(lay(m)<=avail) lo=m; else hi=m; } z=lo; }
      else { z=Z0; lo=30; hi=CAP; for(i=0;i<8;i++){ m=Math.round((lo+hi)/2); if(lay(z,m)<=avail) lo=m; else hi=m; } cap=lo; }
    }
    var h=lay(z,cap);
    if(h>avail){ z=z*avail/h; h=lay(z,cap); }
    cb.style.width=Math.floor(PAGE_W/z)+'px';
    cb.style.transformOrigin='0 0'; cb.style.transform='scale('+z+')';
    wrap.style.width=PAGE_W+'px'; wrap.style.height=Math.ceil(h)+'px';
  }
  // цепочки на листе (владелец 23.11.2026): на экране цепочку детали показывает наведение, на бумаге его нет. Блоки одной детали одного заказа,
  // у которых в этот день стоят разные операции, получают один кружок — буква и цвет на деталь. Одиночные блоки — без метки.
  // Номер шага и «!» убраны по его же слову: порядок виден по времени, на листе нужна только связь.
  var CH='АБВГДЕЖИКЛМНПРСТУФХЦЧШЭЮЯ';
  function printChains(){
    var g={}, keys=[], n=0; S.prCh={}; S.prChN=0;
    people().forEach(function(p){ p.tasks.forEach(function(t){
      if(!t.op||!t.detail) return; var r=refOf(t); if(!r) return;
      var k=lc(t.order+'|'+t.detail); if(!g[k]){ g[k]=[]; keys.push(k); } g[k].push({ t:t, rank:r.rank }); }); });
    keys.forEach(function(k){
      var l=g[k], ranks=[]; l.forEach(function(x){ if(ranks.indexOf(x.rank)<0) ranks.push(x.rank); });
      if(ranks.length<2) return;
      var ltr=CH.charAt(n%CH.length), ci=n%10; n++;
      l.forEach(function(x){ S.prCh[x.t.id]={ tag:ltr, k:ci }; });
    });
    S.prChN=n;
  }
  function printOn(){
    if(S.pr||!S.d||!S.el||!S.el.querySelector('.cb')) return;
    closeDlg(); unrelate(); S.pr=1; document.documentElement.classList.add('cb-printing'); draw();
  }
  function printOff(){ if(!S.pr) return; S.pr=0; document.documentElement.classList.remove('cb-printing'); draw(); }
  // кнопка 🖨 и Ctrl+P ведут в одно место: раскладка под лист ставится до печати и снимается после
  function print(){ printOn(); window.print(); }

  // наведение (владелец 22.11.2026): текст помещается — ничего не происходит; не помещается — блок «раскрывается» на месте,
  // в своём цвете, и показывает текст целиком. Раскрытая копия мышь не перехватывает: блок под ней по-прежнему тянется и щёлкается.
  function clipped(blk){
    if(blk.classList.contains('short')) return true;   // название сокращено — при наведении показываем полное
    if(blk.scrollHeight>blk.clientHeight+6) return true;   // пара пикселей межстрочного запаса — не «не поместилось»
    var p=blk.querySelectorAll('.cb-t, .cb-sx');
    for(var i=0;i<p.length;i++) if(p[i].scrollWidth>p[i].clientWidth+1||p[i].scrollHeight>p[i].clientHeight+1) return true;   // обрезано по ширине или по числу строк
    return false;
  }
  function showTip(blk){
    hideTip(); if(!clipped(blk)) return;
    var r=blk.getBoundingClientRect(), el=S.tip=blk.cloneNode(true);
    el.removeAttribute('data-id'); el.className=blk.className.replace(/\b(rel|drag|saving|late|before|after|short)\b/g,'')+' pop';
    el.style.cssText='left:0;top:0;min-width:'+Math.round(r.width)+'px;min-height:'+Math.round(r.height)+'px';
    document.body.appendChild(el);
    var w=el.offsetWidth, h=el.offsetHeight;
    el.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';
    // внизу доски раскрываемся вверх: под доской — строка с цепочкой детали, её нельзя закрывать
    var wb=$('cbWrap'), bottom=wb?wb.getBoundingClientRect().bottom:window.innerHeight, top=r.top+h>bottom?r.bottom-h:r.top;
    el.style.top=Math.max(8,Math.min(top,window.innerHeight-h-8))+'px';
  }
  function hideTip(){ if(S.tip&&S.tip.parentNode) S.tip.parentNode.removeChild(S.tip); S.tip=null; }
  function drawMsg(){ var m=$('cbMsg'); if(m) m.innerHTML=msgHtml(); }

  /* ── буфер: скопировать блок и вставить в другое место — другому человеку, на другое время или другой день (владелец 23.11.2026) ──
     Буфер живёт, пока его не убрали (Esc или «убрать»): одну работу можно вставить несколько раз. Копия — новый блок: та же работа, количество, длина, примечание. */
  function clipLabel(c){ return c.op?(c.op+((c.model||c.detail)?' · '+(c.model||c.detail):'')+' · '+qtyS(c.qty)+' шт'):c.title; }
  function msgHtml(){
    if(!S.clip) return S.msg;
    return '<span class="cb-clip">📋 Скопировано: <b>'+esc(clipLabel(S.clip))+'</b> — '+(narrow()?'нажмите на место в строке, куда вставить':'щёлкните по месту в строке, куда вставить (или Ctrl+V под курсором)')
      +' · <a href="javascript:void(0)" onclick="twCrewBoard._clipOff()">убрать</a></span>'+(S.msg?' · '+S.msg:'');
  }
  function copyBlk(id){
    var f=taskBy(id); if(!f) return; var t=f.t;
    S.clip={ op:t.op, detail:t.detail, order:t.order, eq:t.eq, model:t.model, rate:t.rate, qty:t.qty, title:t.title, dur:t.dur, manual:t.manual };
    S.msg=''; draw();
  }
  function clipOff(){ if(!S.clip) return; S.clip=null; draw(); }
  function pasteAt(name,start){
    var c=S.clip; if(!c||!person(name)) return;
    var pt=c.op?{ op:c.op, detail:c.detail, order:c.order, eq:c.eq, model:c.model, rate:c.rate, qty:c.qty, title:c.title }:{ title:c.title };
    pt.start=start; pt.dur=c.dur; pt.manual=c.manual;
    remember(); send({ vapi:'crewtask', date:S.date, worker:name, patch:JSON.stringify(pt) },function(r){ merge(r.rows); });
  }
  // Ctrl+V — туда, где сейчас курсор
  function pasteAtPointer(){
    var e0=S.pt&&document.elementFromPoint(S.pt.x,S.pt.y), lane=e0&&closest(e0,'cb-lane');
    if(!lane||lane.classList.contains('cb-hours')||!S.el.contains(lane)){ say('Наведите курсор на строку человека, куда вставить, и нажмите Ctrl+V — или просто щёлкните по месту',1); return; }
    pasteAt(lane.getAttribute('data-w'),minAt(lane,S.pt.x,scale()));
  }
  function drawActions(){
    var a=S.o.actions; if(!a) return;
    // 26.11.2026: «найти человека» — то же поле поиска, что в выработке и табеле (tw-pick.js). Строка найденного подсвечивается, остальные остаются:
    // работу по-прежнему можно тянуть к соседям. Поле стоит перед кнопками и создаётся один раз — кнопки перерисовываются при каждом действии и
    // при подтягивании чужих правок, а в поле в это время могут печатать.
    if(window.pkHtml&&window.TWPICK){
      if(!$('cbfpick')){
        TWPICK.cbf={ val:'cbFind', allLabel:'👥 Все', rows:function(){ return people().map(function(p){ return { name:p.name, n:p.home||'' }; }); },
          done:function(){ S.find=$('cbFind').value; draw(); var r=S.el.querySelector('.cb-row.find'); if(r&&r.scrollIntoView) r.scrollIntoView({ block:'center' }); } };
        a.insertAdjacentHTML('beforebegin',pkHtml('cbf',narrow()?'🔎 человек':'🔎 найти человека',S.find||''));
      } else if($('cbFind').value!==(S.find||'')){ $('cbFind').value=S.find||''; pkSync('cbf'); }
    }
    // на телефоне кнопки короткие и без печати — доска должна начинаться как можно выше
    var n=narrow(), det=isDet();
    a.innerHTML='<button class="sec sm" onclick="twCrewBoard._det()" title="'+(det?'сейчас подробно: текст задач целиком, строки выше — нажмите, чтобы вернуть компактный вид':'сейчас компактно: все люди на экране — нажмите, чтобы показать текст задач целиком')+'">'+(n?(det?'▤':'☰'):(det?'▤ Подробно':'☰ Компактно'))+'</button>'
      +'<button class="sec sm" onclick="twCrewBoard.addPerson()" title="добавить человека на этот день">'+(n?'＋👤':'＋ Человек')+'</button>'
      +'<button class="sec sm" onclick="twCrewBoard.carry()" title="перенести на этот день работу, которую вчера не доделали">'+(n?'↪':'↪ Недоделанное')+'</button>'
      +'<button class="sec sm" onclick="twCrewBoard.sendAll()" title="разослать задания в Telegram">'+(n?'📨':'📨 Разослать')+'</button>'
      +(n?'':'<button class="sec sm" onclick="twCrewBoard.print()" title="печать: подробный вид на один альбомный лист A4">🖨</button>')
      +'<button class="sec sm" onclick="twCrewBoard.undo()"'+(S.undo.length?'':' disabled')+' title="отменить последнее действие (Ctrl+Z)">↶</button>'
      +(n?'':'<button class="sec sm" onclick="twCrewBoard._help()" title="как пользоваться доской">?</button>');
  }

  /* ── отмена: снимок дня до действия; вернуть = привести день к снимку ── */
  function snapshot(){ return JSON.stringify({ date:S.date, people:people().map(function(p){ return { name:p.name, tasks:p.tasks }; }) }); }
  function remember(){ S.undo.push(snapshot()); if(S.undo.length>30) S.undo.shift(); drawActions(); }
  function undo(){
    var raw=S.undo.pop(); drawActions(); if(!raw) return;
    var b=JSON.parse(raw); if(b.date!==S.date) return;
    // пока идёт отмена, чужие правки не подтягиваем: промежуточное состояние дня приняли бы за чужую правку
    S.busy++; S.rev++;
    var was={}, layout=[], jobs=[];
    b.people.forEach(function(p){ p.tasks.forEach(function(t){ was[t.id]={ name:p.name, t:t }; if(t.timed) layout.push({ id:t.id, start:t.start, dur:t.dur }); }); });
    var nowIds={};
    people().forEach(function(p){ p.tasks.forEach(function(t){
      nowIds[t.id]=1; var w=was[t.id];
      if(!w){ jobs.push({ vapi:'crewtaskdel', date:S.date, id:t.id }); return; }
      var o=w.t;
      // работу блока могли заменить (другая деталь, операция, заказ) — возвращаем и её
      var swapped=o.op!==t.op||o.detail!==t.detail||o.order!==t.order||o.model!==t.model;
      if(w.name!==p.name||o.start!==t.start||o.dur!==t.dur||o.qty!==t.qty||o.title!==t.title||o.manual!==t.manual||swapped){
        var pt={ to:w.name, start:o.start, dur:o.dur, manual:o.manual, qty:o.qty, title:o.title };
        if(swapped&&o.op){ pt.op=o.op; pt.detail=o.detail; pt.order=o.order; pt.eq=o.eq; pt.model=o.model; pt.rate=o.rate; }
        jobs.push({ vapi:'crewtask', date:S.date, id:t.id, worker:w.name, patch:JSON.stringify(pt), layout:JSON.stringify(layout) });
      }
    }); });
    Object.keys(was).forEach(function(id){ if(nowIds[id]) return; var w=was[id], o=w.t;   // удалённый блок возвращается новым (id другой)
      jobs.push({ vapi:'crewtask', date:S.date, worker:w.name, patch:JSON.stringify({ op:o.op, detail:o.detail, order:o.order, eq:o.eq, model:o.model, rate:o.rate, qty:o.qty, title:o.title, start:o.start, dur:o.dur, manual:o.manual }), layout:JSON.stringify(layout) }); });
    var names=b.people.map(function(p){ return p.name; }), cur=people().map(function(p){ return p.name; });
    if(names.join('|')!==cur.join('|')) jobs.push({ vapi:'crewsort', date:S.date, names:JSON.stringify(names) });
    (function next(){ var j=jobs.shift(); if(!j){ load(true).then(function(){ S.busy--; say('Отменено'); }); return; } S.o.post(j).then(next,next); })();
  }

  /* ── мышь: перетаскивание блока, растягивание, перестановка людей; щелчок — окно ── */
  function minAt(lane,x,sc){ var r=lane.getBoundingClientRect(), c=cfg(); return Math.round((sc.from+(x-r.left)/r.width*sc.span)/c.snap)*c.snap; }
  function onDown(e){
    S.touch=(e.pointerType==='touch'); S.actAt=Date.now(); hideTip(); unrelate(); S.over=null;
    if(S.touch||e.button||S.dlg) return;
    var t=e.target, add=t.getAttribute&&t.getAttribute('data-add'); if(add) return;
    var grip=closest(t,'cb-grip'), blk=closest(t,'cb-blk'), lane=closest(t,'cb-lane'), sc=scale();
    if(grip){ var row=closest(grip,'cb-row'); S.drag={ mode:'row', el:row, y0:e.clientY, moved:false }; row.classList.add('drag'); }
    else if(blk){
      var f=taskBy(blk.getAttribute('data-id')); if(!f) return;
      S.drag={ mode:t.classList.contains('cb-rz')?'rz':(t.classList.contains('cb-rv')?'sv':'mv'), el:blk, id:f.t.id, task:f.t, names:[], x0:e.clientX, y0:e.clientY, moved:false, start:f.t.start, dur:f.t.dur, s0:f.t.start, d0:f.t.dur,
        from:f.p.name, to:f.p.name, w:lane.getBoundingClientRect().width, sc:sc };
    } else if(lane&&!lane.classList.contains('cb-hours')) S.drag={ mode:'new', lane:lane, x0:e.clientX, y0:e.clientY, moved:false, sc:sc };
    else return;
    e.preventDefault();
    window.addEventListener('pointermove',onMove); window.addEventListener('pointerup',onUp);
  }
  function onMove(e){
    var g=S.drag; if(!g) return;
    var dx=e.clientX-g.x0, dy=e.clientY-g.y0;
    if(!g.moved){ if(Math.abs(dx)<4&&Math.abs(dy)<4) return; g.moved=true; if(g.el) g.el.classList.add('drag'); }
    var c=cfg();
    if(g.mode==='row'){
      var rows=S.el.querySelectorAll('.cb-row'), i, put=null;
      for(i=0;i<rows.length;i++){ if(rows[i]===g.el) continue; var r=rows[i].getBoundingClientRect(); if(e.clientY<r.top+r.height/2){ put=rows[i]; break; } }
      var par=g.el.parentNode, nowLine=par.querySelector('.cb-now');
      if(put){ if(put.previousSibling!==g.el) par.insertBefore(g.el,put); } else par.insertBefore(g.el,nowLine);
      return;
    }
    if(g.mode==='new') return;
    if(g.mode==='sv'){
      // тянем нижний край по вертикали: работа делится между всеми строками от своей до той, где курсор
      var ls=S.el.querySelectorAll('.cb-row .cb-lane'), at=-1, own=-1, j;
      for(j=0;j<ls.length;j++){ var b=ls[j].getBoundingClientRect(); if(ls[j]===g.el.parentNode) own=j; if(e.clientY>=b.top&&e.clientY<b.bottom) at=j; }
      if(at<0) at=(e.clientY<ls[0].getBoundingClientRect().top)?0:ls.length-1;
      var old=S.el.querySelectorAll('.cb-blk.ghost'); for(j=0;j<old.length;j++) old[j].parentNode.removeChild(old[j]);
      g.names=[]; for(j=Math.min(own,at);j<=Math.max(own,at);j++) if(j!==own) g.names.push(ls[j].getAttribute('data-w'));
      var n=g.names.length+1, sh=shareOf(g.task,n), t0=g.task, lbl=g.el.querySelector('.cb-sx, .cb-t2');
      g.bad=sh.bad; g.el.style.width=((n>1?sh.dur:t0.dur)/g.sc.span*100)+'%';
      if(lbl){ if(g.txt==null) g.txt=lbl.textContent; lbl.textContent=n>1?(sh.bad?(qtyS(t0.qty)+' шт на '+n+' чел. не делится'):('на '+n+' чел.'+(t0.op?' · по '+qtyS(sh.qty)+' шт':'')+' · '+durS(sh.dur))):g.txt; }
      if(n>1&&!sh.bad) for(j=Math.min(own,at);j<=Math.max(own,at);j++){ if(j===own) continue;
        var gh=g.el.cloneNode(true); gh.classList.add('ghost'); gh.classList.remove('drag'); gh.removeAttribute('data-id'); ls[j].appendChild(gh); }
      return;
    }
    var dm=Math.round(dx/g.w*g.sc.span/c.snap)*c.snap;
    if(g.mode==='rz'){ g.dur=Math.max(c.snap,g.d0+dm); g.el.style.width=(g.dur/g.sc.span*100)+'%'; var s=g.el.querySelector('.cb-sx, .cb-t2'); if(s&&!g.lbl) g.lbl=s; if(g.lbl) g.lbl.textContent=hm(g.start)+'–'+hm(g.start+g.dur)+' · '+durS(g.dur); return; }
    g.start=Math.max(g.sc.from,Math.min(g.sc.to-c.snap,g.s0+dm)); g.el.style.left=((g.start-g.sc.from)/g.sc.span*100)+'%';
    var lanes=S.el.querySelectorAll('.cb-row .cb-lane');
    for(var k=0;k<lanes.length;k++){ var q=lanes[k].getBoundingClientRect(); if(e.clientY>=q.top&&e.clientY<q.bottom){ if(g.el.parentNode!==lanes[k]){ lanes[k].appendChild(g.el); g.to=lanes[k].getAttribute('data-w'); } break; } }
  }
  function onUp(e){
    window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp);
    var g=S.drag; S.drag=null; if(!g) return;
    if(g.el) g.el.classList.remove('drag');
    if(!g.moved){
      if(g.mode==='new'){ var w0=g.lane.getAttribute('data-w'), m0=minAt(g.lane,e.clientX,g.sc); if(S.clip) pasteAt(w0,m0); else openAdd(w0,m0); }
      else if(g.mode!=='row') openEdit(g.id);
      return;
    }
    if(g.mode==='row'){
      var names=[].map.call(S.el.querySelectorAll('.cb-row'),function(r){ return r.getAttribute('data-w'); });
      if(names.join('|')===people().map(function(p){ return p.name; }).join('|')) return;
      remember(); S.d.people.sort(function(a,b){ return names.indexOf(a.name)-names.indexOf(b.name); });
      send({ vapi:'crewsort', date:S.date, names:JSON.stringify(names) }); return;
    }
    if(g.mode==='sv'){
      var gs=S.el.querySelectorAll('.cb-blk.ghost'); for(var q=0;q<gs.length;q++) gs[q].parentNode.removeChild(gs[q]);
      if(!g.names.length||g.bad){ draw(); if(g.bad) say('Штук меньше, чем людей, — работу не разделить',1); return; }
      splitWith(g.id,g.names); return;
    }
    var patch={};
    if(g.mode==='rz'){ if(g.dur===g.d0){ draw(); return; } patch.dur=g.dur; }
    else { if(g.start===g.s0&&g.to===g.from){ draw(); return; } patch.start=g.start; if(g.to!==g.from) patch.to=g.to; }
    remember(); g.el.classList.add('saving');
    send({ vapi:'crewtask', date:S.date, id:g.id, worker:g.from, patch:JSON.stringify(patch) },function(r){ merge(r.rows); });
  }
  function splitWith(id,names){ remember(); send({ vapi:'crewsplit', date:S.date, id:id, to:JSON.stringify(names) },function(r){ merge(r.rows); say('Работа разделена на '+(names.length+1)+' чел. — количество и время поровну'); }); }
  // телефон: тап по блоку — окно, тап по пустому месту — добавить
  function onClick(e){
    var t=e.target, add=t.getAttribute&&t.getAttribute('data-add'); if(add){ addHour(add); return; }
    var nm=closest(t,'cb-nm'); if(nm){ openPerson(closest(nm,'cb-row').getAttribute('data-w')); return; }
    if(!S.touch) return;
    var blk=closest(t,'cb-blk'), lane=closest(t,'cb-lane');
    if(blk) openEdit(blk.getAttribute('data-id'));
    else if(lane&&!lane.classList.contains('cb-hours')){ var w1=lane.getAttribute('data-w'), m1=minAt(lane,e.clientX,scale()); if(S.clip) pasteAt(w1,m1); else openAdd(w1,m1); }
  }
  // наведение на блок — цепочка этой детали на сегодня (владелец 22.11.2026: «что должно быть сделано до» — понятнее):
  // блоки той же детали получают номер шага по техпорядку; шаги ДО наведённого — акцентом, ПОСЛЕ — серым, остальные блоки приглушаются;
  // внизу цепочка словами. Красным — шаг, который по времени стоит не на своём месте (предыдущий начинается позже следующего).
  function unrelate(){
    var cb=S.el.querySelector('.cb'); if(cb) cb.classList.remove('focus');
    var all=S.el.querySelectorAll('.cb-blk.rel, .cb-blk.cur'), i;
    for(i=0;i<all.length;i++){ all[i].classList.remove('rel','cur','before','after','late'); all[i].removeAttribute('data-step'); }
    var ch=$('cbChain'), lg=$('cbLegend'); if(ch){ ch.hidden=true; ch.innerHTML=''; } if(lg) lg.hidden=false;
  }
  function relate(blk){
    var f=taskBy(blk.getAttribute('data-id')); if(!f||!f.t.op||!f.t.detail) return;
    var cur=f.t, list=[], known=true;
    people().forEach(function(p){ p.tasks.forEach(function(x){
      if(!x.op||x.order!==cur.order||lc(x.detail)!==lc(cur.detail)) return;
      var r=refOf(x); if(!r) known=false; list.push({ t:x, p:p, rank:r?r.rank:0 }); }); });
    if(list.length<2) return;
    var cb=S.el.querySelector('.cb'), el0=function(id){ return S.el.querySelector('.cb-row .cb-blk[data-id="'+id+'"]'); };
    cb.classList.add('focus');
    if(!known){ list.forEach(function(x){ var e=el0(x.t.id); if(e) e.classList.add(x.t.id===cur.id?'cur':'rel'); }); return; }   // справочник работ ещё не загрузился — просто та же деталь
    list.sort(function(a,b){ return a.rank-b.rank || a.t.start-b.t.start; });
    var ranks=[]; list.forEach(function(x){ if(ranks.indexOf(x.rank)<0) ranks.push(x.rank); });
    var myRank=refOf(cur).rank, parts=[];
    list.forEach(function(x){
      var e=el0(x.t.id), step=ranks.indexOf(x.rank)+1, me=x.t.id===cur.id, side=x.rank<myRank?'before':(x.rank>myRank?'after':'');
      // не на своём месте по времени: шаг «до» начинается позже наведённого или шаг «после» — раньше
      var late=!me&&((side==='before'&&x.t.start>cur.start)||(side==='after'&&x.t.start<cur.start));
      if(e){ e.classList.add(me?'cur':'rel'); if(side) e.classList.add(side); if(late) e.classList.add('late'); e.setAttribute('data-step',step); }
      parts.push('<span class="cb-st'+(me?' cur':'')+(side?' '+side:'')+(late?' late':'')+'"><i>'+step+'</i>'+esc(x.t.op)+' — '+esc(shortName(x.p.name))+' '+hm(x.t.start)+(late?' ⚠ не по порядку':'')+'</span>');
    });
    var ch=$('cbChain'), lg=$('cbLegend');
    if(ch){ ch.innerHTML='<b>'+esc(cur.detail)+'</b> · '+esc(cur.order)+': '+parts.join('<span class="cb-arr">→</span>'); ch.hidden=false; if(lg) lg.hidden=true; }
  }
  function onOver(e){
    var blk=closest(e.target,'cb-blk');
    if(blk&&blk===S.over) return;
    S.over=blk; unrelate();
    if(!blk||S.drag||S.touch||blk.classList.contains('ghost')){ hideTip(); return; }
    relate(blk); showTip(blk);
  }
  function onKey(e){
    if(!S.el||!document.body.contains(S.el)||!S.el.querySelector('.cb')) return;
    if(e.key==='Escape'&&S.dlg){ closeDlg(); return; }
    if(e.key==='Escape'&&S.clip){ clipOff(); return; }
    var tag=(e.target&&e.target.tagName)||'';
    // Ctrl+C — блок под курсором, Ctrl+V — под курсор; по коду клавиши, чтобы работало и в русской раскладке. Выделенный текст и поля ввода не трогаем
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&!S.dlg&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){
      var sel=''; try{ sel=String(window.getSelection()||''); }catch(x){}
      // code бывает пустым (экранные клавиатуры) — тогда по букве: латинская или та же клавиша в русской раскладке
      var k=String(e.key||'').toLowerCase(), isC=e.code?e.code==='KeyC':(k==='c'||k==='с'), isV=e.code?e.code==='KeyV':(k==='v'||k==='м');
      if(isC&&!sel&&S.over&&!S.over.classList.contains('ghost')){ e.preventDefault(); copyBlk(S.over.getAttribute('data-id')); return; }
      if(isV&&S.clip){ e.preventDefault(); pasteAtPointer(); return; }
    }
    if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='я')&&!S.dlg&&tag!=='INPUT'&&tag!=='TEXTAREA'){ e.preventDefault(); undo(); }
  }

  /* ── окна ── */
  function openDlg(kind,html,st){
    closeDlg();
    var bg=document.createElement('div'); bg.className='dlg-bg cb-dlg'; bg.innerHTML='<div class="dlg sm">'+html+'</div>';
    bg.addEventListener('mousedown',function(e){ if(e.target===bg) closeDlg(); });
    document.body.appendChild(bg); S.dlg=st||{}; S.dlg.kind=kind; S.dlg.bg=bg;
  }
  function closeDlg(){ if(S.dlg&&S.dlg.bg&&S.dlg.bg.parentNode) S.dlg.bg.parentNode.removeChild(S.dlg.bg); S.dlg=null; }
  // длинный текст задания виден целиком: поле растёт по содержимому. Enter сохраняет, поэтому текст остаётся одной строкой
  function grow(el){ var f=function(){ el.style.height='auto'; el.style.height=(el.scrollHeight+2)+'px'; }; el.addEventListener('input',f); f(); }
  function line(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function dlgErr(t){ var m=$('cbErr'); if(m) m.innerHTML=t?'<span class="err">'+esc(t)+'</span>':''; }

  // добавить работу: одно поле — поиск по работам всех открытых заказов или текст
  function matches(q,p){
    // слово из одной буквы — шум, а цифра — нет: «Дом 2» и «Дом 1» разные детали
    var rows=S.refs||[], words=lc(q).split(/[\s,.]+/).filter(function(w){ return w.length>1||/\d/.test(w); }), home=(p&&p.home)||'';
    var out=rows.filter(function(r){ var t=lc([r.order,r.name,r.eq,r.model,r.detail,r.op,r.group].join(' '));
      return words.every(function(w){ return (w.length===1?(' '+t+' ').replace(/[^a-zа-я0-9]+/g,' ').indexOf(' '+w+' ')>=0:t.indexOf(w)>=0)||(w.length>4&&t.indexOf(w.slice(0,Math.max(4,w.length-2)))>=0); }); });
    if(!words.length) out=out.filter(function(r){ return r.avail>0; });
    // сделанное по заказу полностью — в конце: найти можно (работа сверх заказа), но вперёд не лезет
    out.sort(function(a,b){ return (a.left>0?0:1)-(b.left>0?0:1) || (a.group===home?0:1)-(b.group===home?0:1) || (b.avail>0?1:0)-(a.avail>0?1:0) || b.avail*b.rate-a.avail*a.rate; });
    return out.slice(0,14);
  }
  function openAdd(name,start){
    var p=person(name); if(!p) return;
    openDlg('add','<div class="cb-dh"><b>'+esc(shortName(name))+'</b> · с '+hm(start)+'</div>'
      +'<input id="cbQ" autocomplete="off" placeholder="деталь, операция, заказ — или просто текст задания">'
      +'<div class="cb-list" id="cbList"></div><div id="cbPick"></div><div class="cb-hint" id="cbTip">Enter — записать текстом · ↓ и Enter — выбрать работу из списка</div><div id="cbErr"></div>',
      { name:name, start:start, sel:-1, list:[], pick:null });
    var q=$('cbQ'); q.focus();
    q.addEventListener('input',function(){ S.dlg.sel=-1; S.dlg.pick=null; $('cbPick').innerHTML=''; dlgList(); });
    q.addEventListener('keydown',function(e){
      var d=S.dlg; if(!d) return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!d.list.length) return; d.sel=Math.max(-1,Math.min(d.list.length-1,d.sel+(e.key==='ArrowDown'?1:-1))); dlgList(true); }
      else if(e.key==='Enter'){ e.preventDefault(); if(d.sel>=0) pick(d.sel); else addText(); }
    });
    dlgList();
  }
  function refRow(r,i,sel){
    return '<div class="cb-li'+(i===sel?' sel':'')+'" data-i="'+i+'"><span class="cb-dot'+colorOf(r.group)+'"></span>'
          +'<span class="cb-lt"><b>'+esc(r.op)+'</b> · '+esc(r.level==='изделие'?(r.model||r.eq):r.detail)+'<i>'+esc(r.order)+(r.name?' · '+esc(r.name):'')+'</i></span>'
          +'<span class="cb-ln">'+(!(r.left>0)?('сделано<i>'+qtyS(r.done)+' из '+qtyS(r.need)+'</i>'):r.prev?('можно '+qtyS(r.avail)+'<i>осталось '+qtyS(r.left)+'</i>'):('по заказу '+qtyS(r.left)+'<i>первая операция</i>'))+'</span></div>';
  }
  function dlgList(keep){
    var d=S.dlg; if(!d||d.kind!=='add'||d.pick) return;
    if(!keep) d.list=matches($('cbQ').value,person(d.name));
    $('cbList').innerHTML=!S.refs?'<div class="muted cb-li0">список работ загружается…</div>'
      :(d.list.length?d.list.map(function(r,i){
        return refRow(r,i,d.sel); }).join('')
        :'<div class="muted cb-li0">'+($('cbQ').value.trim()?'в открытых заказах такого нет — Enter запишет как текст':'сейчас нет работ, которые можно брать сразу, — начните писать')+'</div>');
    var li=$('cbList').querySelectorAll('.cb-li'); for(var i=0;i<li.length;i++) li[i].addEventListener('mousedown',function(e){ e.preventDefault(); pick(+this.getAttribute('data-i')); });
  }
  function pick(i){
    var d=S.dlg, r=d.list[i]; if(!r) return;
    d.pick=r;
    // сколько предложить: что лежит перед операцией, но не больше, чем помещается до следующего блока (или конца дня)
    var c=cfg(), p=person(d.name), end=Math.max(c.to,d.start+60); p.tasks.forEach(function(t){ if(t.start>d.start&&t.start<end) end=t.start; });
    var fit=r.rate>0?Math.floor((end-d.start)/60*c.hourRate*c.efficiency/r.rate):0, have=r.avail>0?r.avail:r.left, q0=!(have>0)?'':(fit>0?Math.min(have,fit):have);
    $('cbList').innerHTML='';
    $('cbTip').innerHTML='';
    $('cbPick').innerHTML='<div class="cb-picked"><span class="cb-dot'+colorOf(r.group)+'"></span><span><b>'+esc(r.op)+'</b> · '+esc(r.level==='изделие'?(r.model||r.eq):r.detail)
      +'<i>'+esc(r.order)+' · '+esc(r.group)+' · '+String(r.rate).replace('.',',')+' ₽/шт · '+(!(r.left>0)?('по заказу уже сделано '+qtyS(r.done)+' из '+qtyS(r.need)+' — работа пойдёт сверх заказа'):r.prev?('можно '+qtyS(r.avail)+', осталось '+qtyS(r.left)):('по заказу осталось '+qtyS(r.left)))+'</i></span></div>'
      +'<div class="cb-f"><label>Количество, шт</label><input id="cbQty" inputmode="decimal" value="'+String(q0).replace('.',',')+'"><span id="cbDur" class="cb-dur"></span></div>'
      +(fit>0&&(fit<have||!(have>0))?'<div class="cb-hint">до '+hm(end)+' помещается '+qtyS(fit)+' шт</div>':'')
      +'<div class="cb-f"><label>Примечание</label><textarea id="cbNote" rows="1" placeholder="необязательно: что учесть"></textarea></div>'
      +'<div class="dlg-btns"><button class="sec" onclick="twCrewBoard._back()">← другая работа</button><button onclick="twCrewBoard._addPicked()">Поставить</button></div>';
    var qi=$('cbQty'), upd=function(){ $('cbDur').textContent='≈ '+durS(calcDur(num(qi.value),r.rate))+durWhy(num(qi.value),r.rate); };
    qi.addEventListener('input',upd); qi.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addPicked(); } }); upd(); qi.focus(); qi.select();
    $('cbNote').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addPicked(); } }); grow($('cbNote'));
  }
  function back(){ var d=S.dlg; if(!d) return; d.pick=null; $('cbPick').innerHTML=''; $('cbTip').innerHTML='Enter — записать текстом · ↓ и Enter — выбрать работу из списка'; dlgList(); $('cbQ').focus(); }
  function addPicked(){
    var d=S.dlg, r=d&&d.pick; if(!r) return;
    var q=num($('cbQty').value); if(!(q>0)){ dlgErr('Укажите количество'); return; }
    var note=$('cbNote')?line($('cbNote').value):'';
    create(d.name,{ op:r.op, detail:r.detail, order:r.order, eq:r.eq, model:r.model, rate:r.rate, qty:q, start:d.start, title:note });
  }
  function addText(){ var d=S.dlg, v=$('cbQ').value.trim(); if(!v){ dlgErr('Напишите, что делать, или выберите работу'); return; } create(d.name,{ title:v, start:d.start }); }
  function create(name,patch){ closeDlg(); remember(); send({ vapi:'crewtask', date:S.date, worker:name, patch:JSON.stringify(patch) },function(r){ merge(r.rows); }); }

  // блок: количество, время, кому, удалить
  function openEdit(id){
    var f=taskBy(id); if(!f) return; var t=f.t, free=!t.op, h=hintOf(t);
    var opts=people().map(function(p){ return '<option'+(p.name===f.p.name?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('');
    // 26.11.2026: «Кому» и «Вместе с» — то же поле поиска, что в выработке и зарплате (tw-pick.js); имя лежит в скрытых cbWho / cbWith, сохранение не меняется.
    // Файл поиска не загрузился — остаются обычные списки.
    var pk=!!(window.pkHtml&&window.TWPICK), names=function(skip){ return people().filter(function(p){ return p.name!==skip; }).map(function(p){ return { name:p.name, n:p.home||'' }; }); },
      withTip=function(){ var w=$('cbWith'), sh=shareOf(t,2); if(w) $('cbWithTip').textContent=w.value?(sh.bad?'не делится: всего '+qtyS(t.qty)+' шт':('каждому'+(t.op?' по '+qtyS(sh.qty)+' шт,':'')+' '+durS(sh.dur))):''; };
    if(pk){
      TWPICK.cbw={ val:'cbWho', must:true, rows:function(){ return names(); }, done:function(){} };
      TWPICK.cbv={ val:'cbWith', allLabel:'— делает один —', rows:function(){ return names($('cbWho').value); }, done:withTip };
    }
    openDlg('edit',(free?('<div class="cb-f wide"><label>Что делать</label><textarea id="cbTitle" rows="1">'+esc(t.title)+'</textarea></div>')
        :('<div class="cb-picked"><span class="cb-dot'+colorOf(t.group)+'" id="cbHeadDot"></span><span id="cbHead"><b>'+esc(t.op)+'</b>'+(t.model?' · '+esc(t.model):(t.detail?' · '+esc(t.detail):''))
          +'<i>'+esc([t.order,t.group,t.rate?String(t.rate).replace('.',',')+' ₽/шт':''].filter(Boolean).join(' · '))+'</i></span>'
          +'<span class="cb-sp"></span><button class="gho sm" id="cbSwapBtn" title="назначили не ту деталь или операцию — выбрать другую, не удаляя блок: время, человек и количество останутся">✎ заменить</button></div>'
          +'<div id="cbSwap" hidden><input id="cbQ2" autocomplete="off" placeholder="деталь, операция, заказ"><div class="cb-list" id="cbList2"></div></div>'
          +'<div class="cb-f"><label>Количество, шт</label><input id="cbQty" inputmode="decimal" value="'+String(t.qty).replace('.',',')+'"><span id="cbDur" class="cb-dur"></span></div>'
          +'<div class="cb-f"><label>Примечание</label><textarea id="cbNote" rows="1" placeholder="необязательно: что учесть">'+esc(t.title||'')+'</textarea></div>'))
      +'<div class="cb-f"><label>Время</label><input type="time" id="cbFrom" step="900" value="'+hm2(t.start)+'"><span>—</span><input type="time" id="cbTo" step="900" value="'+hm2(t.start+t.dur)+'">'
        +(free?'':'<button class="gho sm" id="cbAuto" title="поставить длину по расчёту из количества и расценки">по расчёту</button>')+'</div>'
      +'<div class="cb-f"><label for="cbwq">Кому</label>'+(pk?pkHtml('cbw','🔎 имя или фамилия',f.p.name):'<select id="cbWho">'+opts+'</select>')+'</div>'
      +(people().length>1?'<div class="cb-f"><label for="cbvq">Вместе с</label>'+(pk?pkHtml('cbv','— делает один —','')
        :'<select id="cbWith"><option value="">— делает один —</option>'+people().filter(function(p){ return p.name!==f.p.name; }).map(function(p){ return '<option>'+esc(p.name)+'</option>'; }).join('')+'</select>')+'<span class="cb-dur" id="cbWithTip"></span></div>':'')
      +(h?'<div class="cb-hint'+(h.warn?' warn':'')+'">'+esc(hintText(t,h))+'</div>':'')+(t.done>0?'<div class="cb-hint ok">сдано нарядами: '+qtyS(t.done)+' из '+qtyS(t.qty)+' шт</div>':'')
      +'<div id="cbErr"></div><div class="dlg-btns"><button class="sec danger" onclick="twCrewBoard._del()">Удалить</button><button class="sec" onclick="twCrewBoard._copy()" title="скопировать блок, чтобы вставить его в другом месте: у другого человека, на другое время или в другом дне">⧉ Копировать</button><span class="cb-sp"></span>'
      +'<button class="sec" onclick="twCrewBoard._close()">Отмена</button><button onclick="twCrewBoard._save()">Сохранить</button></div>',{ id:id, auto:false, ref:null, list:[], sel:-1 });
    var qi=$('cbQty');
    if(qi){
      // расценка — выбранной на замену работы, если её поменяли
      var rate=function(){ return S.dlg&&S.dlg.ref?S.dlg.ref.rate:t.rate; };
      var upd=function(){ var m=calcDur(num(qi.value),rate()); $('cbDur').textContent='по расчёту '+durS(m)+durWhy(num(qi.value),rate()); if(S.dlg.auto||!t.manual) setEnd(m); };
      qi.addEventListener('input',upd); $('cbDur').textContent='по расчёту '+durS(t.calc)+durWhy(t.qty,t.rate);
      $('cbAuto').addEventListener('click',function(){ S.dlg.auto=true; setEnd(calcDur(num(qi.value),rate())); });
      // заменить работу: тот же поиск, что при добавлении; в поле сразу стоит операция — дописать деталь
      var q2=$('cbQ2'), swapList=function(keep){ var d=S.dlg; if(!keep){ d.list=matches(q2.value,f.p); d.sel=-1; }
        $('cbList2').innerHTML=!S.refs?'<div class="muted cb-li0">список работ загружается…</div>':(d.list.length?d.list.map(function(r,i){ return refRow(r,i,d.sel); }).join(''):'<div class="muted cb-li0">в открытых заказах такого нет</div>');
        var li=$('cbList2').querySelectorAll('.cb-li'); for(var i=0;i<li.length;i++) li[i].addEventListener('mousedown',function(e){ e.preventDefault(); swapPick(+this.getAttribute('data-i')); }); };
      var swapPick=function(i){ var d=S.dlg, r=d.list[i]; if(!r) return; d.ref=r; $('cbSwap').hidden=true;
        $('cbHeadDot').className='cb-dot'+colorOf(r.group);
        $('cbHead').innerHTML='<b>'+esc(r.op)+'</b> · '+esc(r.level==='изделие'?(r.model||r.eq):r.detail)+'<i>'+esc([r.order,r.group,String(r.rate).replace('.',',')+' ₽/шт'].join(' · '))+'</i><i class="cb-was">было: '+esc(t.op+(t.model||t.detail?' · '+(t.model||t.detail):''))+'</i>';
        upd(); qi.focus(); qi.select(); };
      $('cbSwapBtn').addEventListener('click',function(){ var box=$('cbSwap'); box.hidden=!box.hidden; if(!box.hidden){ q2.value=t.op+' '; swapList(); q2.focus(); } });
      q2.addEventListener('input',function(){ swapList(); });
      q2.addEventListener('keydown',function(e){ var d=S.dlg;
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!d.list.length) return; d.sel=Math.max(0,Math.min(d.list.length-1,d.sel+(e.key==='ArrowDown'?1:-1))); swapList(true); }
        else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); swapPick(d.sel>=0?d.sel:0); } });
    }
    $('cbTo').addEventListener('input',function(){ S.dlg.auto=false; S.dlg.touched=true; });
    if($('cbWith')&&!pk) $('cbWith').addEventListener('change',withTip);
    // Enter в поле поиска выбирает человека из списка, а не сохраняет окно
    S.dlg.bg.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.tagName!=='BUTTON'&&!(e.target.closest&&e.target.closest('.pick'))){ e.preventDefault(); saveEdit(); } });
    if($('cbNote')) grow($('cbNote'));
    if(qi) qi.focus(); else { var ti=$('cbTitle'); grow(ti); ti.focus(); ti.setSelectionRange(ti.value.length,ti.value.length); }
  }
  function tm(v){ var m=/^(\d{1,2}):(\d{2})/.exec(v||''); return m?(+m[1])*60+(+m[2]):null; }
  function setEnd(dur){ var a=tm($('cbFrom').value); if(a!=null) $('cbTo').value=hm2(a+dur); }
  function saveEdit(){
    var d=S.dlg, f=d&&taskBy(d.id); if(!f) return closeDlg(); var t=f.t, patch={}, a=tm($('cbFrom').value), b=tm($('cbTo').value);
    if(a==null||b==null){ dlgErr('Укажите время начала и конца'); return; }
    if(b<=a) b+=1440;   // конец после полуночи
    if($('cbTitle')){ var v=line($('cbTitle').value); if(!v){ dlgErr('Напишите, что делать'); return; } if(v!==t.title) patch.title=v; }
    if($('cbQty')){ var q=num($('cbQty').value); if(!(q>0)){ dlgErr('Укажите количество'); return; } if(q!==t.qty) patch.qty=q; }
    if($('cbNote')){ var nt=line($('cbNote').value); if(nt!==(t.title||'')) patch.title=nt; }
    if(a!==t.start) patch.start=a;
    // работу заменили: новая деталь, операция, заказ и расценка — блок, время и человек те же; длину пересчитает сервер, если её не задавали руками
    if(d.ref){ patch.op=d.ref.op; patch.detail=d.ref.detail; patch.order=d.ref.order; patch.eq=d.ref.eq; patch.model=d.ref.model; patch.rate=d.ref.rate; }
    if(d.auto) patch.auto=true; else if(b-a!==t.dur&&(d.touched||(patch.qty==null&&!d.ref)||t.manual)) patch.dur=b-a;
    var to=$('cbWho').value; if(to!==f.p.name) patch.to=to;
    var withP=$('cbWith')?$('cbWith').value:'', id=t.id; if(withP===to) withP='';
    closeDlg(); if(!Object.keys(patch).length&&!withP) return;
    remember();
    // сначала правка самого блока, потом деление: делится уже исправленное количество
    var p0=Object.keys(patch).length?send({ vapi:'crewtask', date:S.date, id:id, worker:f.p.name, patch:JSON.stringify(patch) },function(r){ merge(r.rows); }):Promise.resolve({ ok:true });
    if(withP) p0.then(function(r){ if(r) send({ vapi:'crewsplit', date:S.date, id:id, to:JSON.stringify([withP]) },function(r2){ merge(r2.rows); say('Работа разделена на двоих — количество и время поровну'); }); });
  }
  function delEdit(){ var d=S.dlg; if(!d) return; var id=d.id; closeDlg(); remember(); send({ vapi:'crewtaskdel', date:S.date, id:id },function(r){ merge(r.rows); say('Блок снят — «↶» вернёт'); }); }

  // человек: смена, отправить задание, убрать с доски
  function openPerson(name){
    var p=person(name); if(!p) return;
    var sh=[['день','☀️ 1-я'],['2 смена','🌇 2-я'],['ночь','🌙 ночь']].map(function(x){ return '<button class="'+(p.shift===x[0]?'':'sec')+' sm" onclick="twCrewBoard._shift(\''+x[0]+'\')">'+x[1]+'</button>'; }).join('');
    openDlg('person','<div class="cb-dh"><b>'+esc(name)+'</b>'+(p.home?' · '+esc(p.home):'')+'</div>'
      +'<div class="cb-f"><label>Смена</label>'+sh+'</div>'
      +'<div class="dlg-btns"><button class="sec" onclick="twCrewBoard._sendOne()">📨 Отправить задание</button><span class="cb-sp"></span><button class="sec danger" id="cbRm" onclick="twCrewBoard._remove()">Убрать с доски</button></div><div id="cbErr"></div>',{ name:name, sure:false });
  }
  function setShift(v){ var d=S.dlg; if(!d) return; var n=d.name; closeDlg(); send({ vapi:'planset', date:ruD(S.date), worker:n, patch:JSON.stringify({ shift:v }) },function(){ load(true); }); }
  function removePerson(){
    var d=S.dlg; if(!d) return; var p=person(d.name);
    if(!d.sure&&p&&p.tasks.length){ d.sure=true; $('cbRm').textContent='Точно убрать? Смена и '+p.tasks.length+' блок(ов) удалятся'; return; }
    setShift('');
  }
  function sendOne(){ var d=S.dlg; if(!d) return; var n=d.name; closeDlg(); send({ vapi:'plantasks', date:ruD(S.date), worker:n },function(r){ say(r.sent?'Задание отправлено: '+esc(shortName(n)):'Не отправлено: у человека нет задания или не привязан Telegram',!r.sent); load(true); }); }
  function sendAll(){ send({ vapi:'plantasks', date:ruD(S.date), worker:'' },function(r){ say('Отправлено: '+(r.sent||0)+(r.noTg?' · без Telegram: '+r.noTg:'')+(r.skipped?' · без задания: '+r.skipped:'')); load(true); }); }
  function addPerson(){
    // окно не закрывается после каждого: утром на доску ставят сразу всех
    openDlg('addp','<div class="cb-dh"><b>Добавить на '+dmy(S.date)+'</b> · поставит 1-ю смену в табеле</div><input id="cbPQ" autocomplete="off" placeholder="фамилия и имя"><div class="cb-list" id="cbPL"></div>'
      +'<div id="cbErr"></div><div class="dlg-btns"><span class="cb-sp"></span><button onclick="twCrewBoard._close()">Готово</button></div>',{ added:{} });
    var q=$('cbPQ'), note=function(t){ var m=$('cbErr'); if(m) m.innerHTML=t?'<span class="ok">'+t+'</span>':''; },
      put=function(n){ var d=S.dlg; if(d&&d.kind==='addp'){ d.added[n]=1; q.value=''; drawL(); q.focus(); }
        send({ vapi:'planset', date:ruD(S.date), worker:n, patch:JSON.stringify({ shift:'день' }) },function(){ load(true); }); },
      // кого нет в обычном списке: сотрудник не из цеха (директор, менеджер…) встаёт на доску на этот день; кого нет нигде (новенький, помощник
      // на день) — заводится рабочим без Telegram, как «Сотрудник без телефона» в «Доступах». Оба случая — маршрут crewperson (владелец 25.11.2026)
      mk=function(nm){ dlgErr(''); note(''); send({ vapi:'crewperson', date:S.date, name:nm },function(r){ var d=S.dlg; if(d&&d.kind==='addp'){ d.added[r.name]=1; q.value=''; drawL(); q.focus(); }
          note(r.existed?'«'+esc(r.name)+'»'+(r.role?' ('+esc(r.role)+')':'')+' поставлен на доску на '+dmy(S.date)+'.'
            :'«'+esc(r.name)+'» заведён рабочим без Telegram и поставлен на доску. '+(r.proxyName?'Наряды за него вносит '+esc(r.proxyName)+' — поменять можно в «Доступах».':'Кто вносит за него наряды — назначьте в «Доступах».')); load(true); },
        function(e){ dlgErr(/нет прав/.test(e)?'Нового человека заводит админ, директор или мастер — у вас такого права нет':e); }); },
      // имя ищем по словам в любом порядке: «Евгений Миронов» находит «Миронов Евгений»
      wkey=function(n){ return lc(n).split(/\s+/).filter(Boolean).sort().join(' '); },
      drawL=function(){ var d=S.dlg; if(!d||d.kind!=='addp') return;
        var nm=q.value.replace(/\s+/g,' ').trim(), ws=lc(nm).split(' ').filter(Boolean), k=wkey(nm), same=function(n){ return wkey(n)===k; },
          hit=function(n){ var x=lc(n); return !d.added[n]&&ws.every(function(w){ return x.indexOf(w)>=0; }); },
          l=((S.d&&S.d.rest)||[]).filter(hit), o=nm.length>1?((S.d&&S.d.others)||[]).filter(function(p){ return hit(p.name); }):[],
          on=people().some(function(p){ return same(p.name); })||Object.keys(d.added).some(same);
        $('cbPL').innerHTML=l.map(function(n){ return '<div class="cb-li" data-n="'+esc(n)+'"><span class="cb-lt"><b>'+esc(n)+'</b></span><span class="cb-ln">＋</span></div>'; }).join('')
          +o.map(function(p){ return '<div class="cb-li" data-o="'+esc(p.name)+'"><span class="cb-lt"><b>'+esc(p.name)+'</b><i>'+esc(p.role||'без роли в сервисе')+' · не из цеха — поставить на доску на этот день</i></span><span class="cb-ln">＋</span></div>'; }).join('')
          +(nm&&!on&&!l.some(same)&&!o.some(function(p){ return same(p.name); })?'<div class="cb-li" data-new="1"><span class="cb-lt"><b>＋ Новый человек: '+esc(nm)+'</b><i>его нет в «Доступах» — заведём рабочим без Telegram и поставим на доску</i></span></div>'
            :l.length||o.length?'':'<div class="muted cb-li0">'+(on?'уже на доске':'все уже на доске — впишите фамилию и имя, чтобы добавить другого сотрудника или нового человека')+'</div>');
        var li=$('cbPL').querySelectorAll('.cb-li'); for(var i=0;i<li.length;i++) li[i].addEventListener('click',function(){
          if(this.getAttribute('data-new')) mk(nm); else if(this.getAttribute('data-o')) mk(this.getAttribute('data-o')); else { note(''); dlgErr(''); put(this.getAttribute('data-n')); } }); };
    q.addEventListener('input',drawL);
    q.addEventListener('keydown',function(e){ var f=e.key==='Enter'&&$('cbPL').querySelector('.cb-li'); if(f) f.click(); });
    drawL(); q.focus();
  }
  function carry(){ remember(); send({ vapi:'crewcarry', date:S.date },function(r){ if(r.added){ merge(r.rows); say('Перенесено с '+dmy(r.from)+': '+r.added+(r.noShift?' · не перенесено '+r.noShift+' — человек сегодня не в смене':'')); }
    else { S.undo.pop(); drawActions(); say(r.from?('С '+dmy(r.from)+' переносить нечего'+(r.noShift?' ('+r.noShift+' не перенесено — человек сегодня не в смене)':'')):'За прошлую неделю заданий не было'); } }); }

  var wired=false;
  window.twCrewBoard={
    mount:function(el,o){
      S.el=el; S.o=o; S.date=o.date; S.d=null; S.undo=[]; S.msg=''; S.actAt=0;
      el.innerHTML='<div class="center muted">Загрузка…</div>';
      if(!el._cb){ el._cb=1; el.addEventListener('pointerdown',onDown); el.addEventListener('click',onClick); el.addEventListener('mouseover',onOver); el.addEventListener('mousemove',function(e){ S.pt={ x:e.clientX, y:e.clientY }; });
        el.addEventListener('mouseleave',function(){ S.over=null; unrelate(); hideTip(); }); el.addEventListener('scroll',onScroll,true); }
      if(!wired){ wired=true; document.addEventListener('keydown',onKey); document.addEventListener('visibilitychange',poll); window.addEventListener('focus',poll); window.addEventListener('beforeprint',printOn); window.addEventListener('afterprint',printOff);
        window.addEventListener('resize',function(){ if(S.d&&narrow()) fitBox(); }); setInterval(nowTick,30000); document.addEventListener('visibilitychange',nowTick);
        // раздел в оболочке мог отрисоваться скрытым (высота окна 0) — когда его показали, высоту доски и место линии считаем заново
        window.addEventListener('message',function(e){ if(e&&e.data&&e.data.tw==='show'&&S.d) setTimeout(function(){ fitBox(); nowTick(); },30); }); }
      // шрифт темы догружается после первой отрисовки — имена перемерить ещё раз
      try{ if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ if(S.d){ fitNames(); fitShort(); fitRows(); } }); }catch(e){}
      clearTimeout(S.pollT); S.pollT=setTimeout(poll,POLL_MS);
      return load();
    },
    setDate:function(d){ S.date=d; S.undo=[]; return load(); },
    reload:function(){ return load(true); },
    // оболочка просит обновиться при возврате на вкладку: день подтягиваем на месте (прокрутка и «↶» остаются), а не собираем доску заново
    refresh:function(){ if(S.d&&S.el.querySelector('.cb')) poll(); else load(true); },
    undo:undo, addPerson:addPerson, carry:carry, sendAll:sendAll, print:print, _printOn:printOn, _printOff:printOff,
    _help:function(){ S.help=!S.help; draw(); }, _det:function(){ store('tw_cb_det',isDet()?'0':'1'); draw(); }, _back:back, _addPicked:addPicked, _save:saveEdit, _del:delEdit, _copy:function(){ var d=S.dlg; if(!d) return; var id=d.id; closeDlg(); copyBlk(id); }, _clipOff:clipOff, _rebase:rebase, _close:closeDlg, _shift:setShift, _remove:removePerson, _sendOne:sendOne
  };
})();
