/* Доска расстановки «человек × время» (владелец 22.11.2026): строка — человек из табеля дня, по горизонтали — время,
   блок — работа. Блок тянут мышью (по времени и на другого человека), растягивают за правый край; людей переставляют за ⋮⋮.
   Сервер (prohub src/production/crewBoard.ts): crewboard — день, crewtask / crewtaskdel — один блок, crewsort — порядок людей,
   crewrefs — работы всех открытых заказов (поиск и подсказки считаются здесь, без запроса на каждую букву), crewcarry — недоделанное.
   Запретов нет: «перед операцией нечего брать» — только пометка ⚠. На телефоне блоки не тянут — тап открывает окно с теми же полями.
   twCrewBoard.mount(el, { api, post, date:'гггг-мм-дд', actions:<элемент для кнопок> }); twCrewBoard.setDate(d). */
(function(){
  var S={ el:null, o:null, date:'', d:null, refs:null, refsAt:0, undo:[], msg:'', msgT:0, drag:null, dlg:null, touch:false, busy:0 };
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
  function closest(t,cls){ while(t&&t!==document){ if(t.classList&&t.classList.contains(cls)) return t; t=t.parentNode; } return null; }

  /* ── данные ── */
  function cfg(){ return (S.d&&S.d.cfg)||{ from:480, to:1080, snap:15, efficiency:0.7, hourRate:15 }; }
  function people(){ return (S.d&&S.d.people)||[]; }
  function person(name){ var ps=people(); for(var i=0;i<ps.length;i++) if(ps[i].name===name) return ps[i]; return null; }
  function taskBy(id){ var ps=people(); for(var i=0;i<ps.length;i++) for(var j=0;j<ps[i].tasks.length;j++) if(ps[i].tasks[j].id===id) return { p:ps[i], t:ps[i].tasks[j] }; return null; }
  function load(keepMsg){
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
  function say(t,err){ S.msg=t?('<span class="'+(err?'err':'ok')+'">'+t+'</span>'):''; clearTimeout(S.msgT); if(t&&!err) S.msgT=setTimeout(function(){ S.msg=''; drawMsg(); },7000); drawMsg(); }
  function send(p, ok){
    S.busy++;
    return S.o.post(p).then(function(r){
      S.busy--;
      if(!r||!r.ok){ say(esc((r&&r.error)||'не сохранилось'),1); return load(true).then(function(){ return null; }); }
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
    if(h.over) a.push('по заказу осталось '+qtyS(h.ref.left)+' шт'+(h.first?' — остальное сверх заказа, впрок':''));
    return a.join(' · ');
  }
  // «откуда время»: сумма работы по расценке и темп, которым она делится
  function durWhy(qty,rate){ var c=cfg(); if(!(qty>0&&rate>0)) return ''; return ' · '+(Math.round(qty*rate*100)/100).toLocaleString('ru-RU')+' ₽ по расценке при '+(Math.round(c.hourRate*c.efficiency*100)/100).toLocaleString('ru-RU')+' ₽/час'; }
  function calcDur(qty,rate){ var c=cfg(); if(!(qty>0&&rate>0)) return 60; return Math.max(c.snap,Math.round(qty*rate/(c.hourRate*c.efficiency)*60/c.snap)*c.snap); }

  /* ── отрисовка ── */
  // цвет участка — класс палитры темы по порядку участков: в справочнике операций у раскроя и механики цвет один, блоки сливались бы
  function colorOf(g){ var s=(S.d&&S.d.sites)||[]; for(var i=0;i<s.length;i++) if(s[i].name===g) return g==='Прочее'?'':' cb-c'+(i%7); return ''; }
  function blkHtml(t,sc){
    var free=!t.op, h=hintOf(t), col=free?'':colorOf(t.group);
    var l=(t.start-sc.from)/sc.span*100, w=t.dur/sc.span*100;
    var pct=(!free&&t.qty>0&&t.done>0)?Math.min(100,Math.round(t.done/t.qty*100)):0;
    var tip=(free?t.title:(t.op+(t.detail?' › '+t.detail:'')+(t.order?' · '+t.order:'')))+'\n'+hm(t.start)+'–'+hm(t.start+t.dur)+' ('+durS(t.dur)+')'
      +(free?'':('\n'+qtyS(t.qty)+' шт'+(t.rate?' × '+String(t.rate).replace('.',',')+' ₽':'')+(t.manual?' · длина задана вручную, по расчёту '+durS(t.calc):'')))
      +(t.done>0?'\nсдано нарядами: '+qtyS(t.done)+' шт':'')+(h?('\n'+hintText(t,h)):'');
    return '<div class="cb-blk'+col+(free?' free':'')+(h&&h.warn?' warn':'')+(pct>=100?' done':'')+'" data-id="'+esc(t.id)+'" data-k="'+esc(lc(t.order+'|'+t.detail))+'" title="'+esc(tip)+'"'
      +' style="left:'+l.toFixed(3)+'%;width:'+w.toFixed(3)+'%">'
      +(free?('<span class="cb-t cb-t2">'+esc(t.title)+'</span>')
        :('<span class="cb-t"><b>'+esc(t.op)+'</b>'+(t.detail?' · '+esc(t.detail):(t.model?' · '+esc(t.model):''))+'</span>'
          +'<span class="cb-s">'+qtyS(t.qty)+' шт'+(t.order?' · '+esc(t.order):'')+(t.done>0?' · сдано '+qtyS(t.done):'')+'</span>'))
      +(pct?'<i class="cb-fill" style="width:'+pct+'%"></i>':'')+'<span class="cb-rz"></span></div>';
  }
  function rowHtml(p,sc){
    var c=cfg(), cap=(c.to-c.from)/60, busy=0, rub=0; p.tasks.forEach(function(t){ busy+=t.dur; rub+=t.qty*t.rate; }); busy=busy/60;
    var cls=busy>cap+0.01?' over':(busy>=cap*0.9?' full':'');
    return '<div class="cb-row'+(p.status==='не вышел'?' off':'')+'" data-w="'+esc(p.name)+'">'
      +'<div class="cb-name"><span class="cb-grip" title="перетащите, чтобы переставить человека">⋮⋮</span>'
      +'<span class="cb-nm" title="'+esc(p.name)+(p.home?' · участок: '+esc(p.home):'')+(p.sent?' · задание отправлено':'')+'">'+shIco(p.shift)+esc(p.name)+(p.sent?' <span class="cb-sent">✓</span>':'')+'</span>'
      +(rub>0?'<span class="cb-rub" title="заработает по расценкам, если сделает всё, что стоит в плане: '+money(rub)+' ₽ (до налогов, без премий)">'+Math.round(rub).toLocaleString('ru-RU')+' ₽</span>':'')
      +'<span class="cb-ld'+cls+'" title="занято часов из '+n1(cap)+'">'+(busy?n1(busy):'—')+'<i>/'+n1(cap)+'</i></span></div>'
      +'<div class="cb-lane" data-w="'+esc(p.name)+'">'+p.tasks.map(function(t){ return blkHtml(t,sc); }).join('')+'</div></div>';
  }
  function draw(){
    if(!S.d) return;
    var sc=scale(), c=cfg(), ps=people(), cap=(c.to-c.from)/60, tot=0;
    var rubAll=0; ps.forEach(function(p){ p.tasks.forEach(function(t){ tot+=t.dur; rubAll+=t.qty*t.rate; }); });
    var hours=''; for(var h=sc.from;h<sc.to;h+=60) hours+='<span class="cb-h" style="left:'+((h-sc.from)/sc.span*100).toFixed(3)+'%;width:'+(60/sc.span*100).toFixed(3)+'%">'+(Math.floor(h/60)%24)+'</span>';
    var now='';
    if(S.d.date===S.d.today){ var d=new Date(), m=d.getHours()*60+d.getMinutes(); if(m>sc.from&&m<sc.to) now='<i class="cb-now" style="left:calc(var(--cb-name) + (100% - var(--cb-name)) * '+((m-sc.from)/sc.span).toFixed(4)+')"></i>'; }
    var legend=((S.d.sites)||[]).filter(function(s){ return s.name!=='Прочее'; }).map(function(s){ return '<span class="cb-lg'+colorOf(s.name)+'">'+esc(s.name)+'</span>'; }).join('');
    var sc0=$('cbWrap'), keep=sc0?{ x:sc0.scrollLeft, y:sc0.scrollTop }:null;
    S.el.innerHTML='<div class="cb-msg" id="cbMsg">'+S.msg+'</div>'
      +'<div class="note hint'+(S.help?' show':'')+'" data-hb="1">Щёлкните по пустому месту в строке — добавить работу: начните писать (деталь, операция, заказ) и выберите из списка, или просто впишите текст и нажмите Enter. '
      +'Блок тянется мышью — по времени и на другого человека; за правый край растягивается. Людей переставляют за ⋮⋮. Длина блока считается из количества и расценки при темпе '
      +String(Math.round(c.efficiency*100))+' % от '+String(c.hourRate).replace('.',',')+' ₽/час; растянутый вручную блок помнит свою длину. ⚠ — перед операцией сейчас лежит меньше, чем задано (это подсказка, а не запрет). Зелёная полоска — сколько уже сдано нарядами. Сумма в ₽ у человека — сколько он заработает по расценкам, если сделает весь план (до налогов, без премий).</div>'
      +(ps.length?'':'<div class="empty">На '+dmy(S.d.date)+' в табеле никого нет — добавьте людей кнопкой «＋ Человек».</div>')
      +'<div class="cb-wrap tbl-wrap fill" id="cbWrap"><div class="cb" style="--cb-hours:'+sc.hours+(S.nameW?';--cb-name:'+S.nameW+'px':'')+';min-width:calc(var(--cb-name) + '+(sc.hours*56)+'px)">'
      +'<div class="cb-head"><div class="cb-name cb-corner"><b>'+ps.length+' чел</b>'+(rubAll>0?'<span class="cb-rub" title="работы в плане по расценкам на всех: '+money(rubAll)+' ₽">'+Math.round(rubAll).toLocaleString('ru-RU')+' ₽</span>':'')+'<span class="cb-ld">'+n1(tot/60)+'<i>/'+n1(ps.length*cap)+' ч</i></span></div>'
      +'<div class="cb-lane cb-hours"><button class="cb-add l" title="добавить час раньше" data-add="l">＋</button>'+hours+'<button class="cb-add r" title="добавить час позже" data-add="r">＋</button></div></div>'
      +ps.map(function(p){ return rowHtml(p,sc); }).join('')+now+'</div></div>'
      +'<div class="cb-foot">'+legend+'<span class="cb-lg free">текстом</span></div>';
    fitNames();
    if(keep){ var w=$('cbWrap'); w.scrollLeft=keep.x; w.scrollTop=keep.y; }
    drawActions();
    if(window.twFit) try{ twFit(); }catch(e){}
  }
  // колонка имён — по самому длинному имени: фамилии должны читаться целиком (на телефоне колонка узкая, имя — в подсказке)
  function fitNames(){
    var cb=S.el.querySelector('.cb'); if(!cb||window.innerWidth<=640) return;
    var nm=cb.querySelectorAll('.cb-row .cb-nm'), over=0, i;
    for(i=0;i<nm.length;i++) over=Math.max(over,nm[i].scrollWidth-nm[i].clientWidth);
    if(over<=0) return;
    S.nameW=Math.min(360,cb.querySelector('.cb-row .cb-name').offsetWidth+over+4); cb.style.setProperty('--cb-name',S.nameW+'px');
  }
  function drawMsg(){ var m=$('cbMsg'); if(m) m.innerHTML=S.msg; }
  function drawActions(){
    var a=S.o.actions; if(!a) return;
    a.innerHTML='<button class="sec sm" onclick="twCrewBoard.addPerson()">＋ Человек</button>'
      +'<button class="sec sm" onclick="twCrewBoard.carry()" title="перенести на этот день работу, которую вчера не доделали">↪ Недоделанное</button>'
      +'<button class="sec sm" onclick="twCrewBoard.sendAll()">📨 Разослать</button>'
      +'<button class="sec sm" onclick="window.print()" title="печать на альбомный лист">🖨</button>'
      +'<button class="sec sm" onclick="twCrewBoard.undo()"'+(S.undo.length?'':' disabled')+' title="отменить последнее действие (Ctrl+Z)">↶</button>'
      +'<button class="sec sm" onclick="twCrewBoard._help()" title="как пользоваться доской">?</button>';
  }

  /* ── отмена: снимок дня до действия; вернуть = привести день к снимку ── */
  function snapshot(){ return JSON.stringify({ date:S.date, people:people().map(function(p){ return { name:p.name, tasks:p.tasks }; }) }); }
  function remember(){ S.undo.push(snapshot()); if(S.undo.length>30) S.undo.shift(); drawActions(); }
  function undo(){
    var raw=S.undo.pop(); drawActions(); if(!raw) return;
    var b=JSON.parse(raw); if(b.date!==S.date) return;
    var was={}, layout=[], jobs=[];
    b.people.forEach(function(p){ p.tasks.forEach(function(t){ was[t.id]={ name:p.name, t:t }; if(t.timed) layout.push({ id:t.id, start:t.start, dur:t.dur }); }); });
    var nowIds={};
    people().forEach(function(p){ p.tasks.forEach(function(t){
      nowIds[t.id]=1; var w=was[t.id];
      if(!w){ jobs.push({ vapi:'crewtaskdel', date:S.date, id:t.id }); return; }
      var o=w.t;
      if(w.name!==p.name||o.start!==t.start||o.dur!==t.dur||o.qty!==t.qty||o.title!==t.title||o.manual!==t.manual)
        jobs.push({ vapi:'crewtask', date:S.date, id:t.id, worker:w.name, patch:JSON.stringify({ to:w.name, start:o.start, dur:o.dur, manual:o.manual, qty:o.qty, title:o.title }), layout:JSON.stringify(layout) });
    }); });
    Object.keys(was).forEach(function(id){ if(nowIds[id]) return; var w=was[id], o=w.t;   // удалённый блок возвращается новым (id другой)
      jobs.push({ vapi:'crewtask', date:S.date, worker:w.name, patch:JSON.stringify({ op:o.op, detail:o.detail, order:o.order, eq:o.eq, model:o.model, rate:o.rate, qty:o.qty, title:o.title, start:o.start, dur:o.dur, manual:o.manual }), layout:JSON.stringify(layout) }); });
    var names=b.people.map(function(p){ return p.name; }), cur=people().map(function(p){ return p.name; });
    if(names.join('|')!==cur.join('|')) jobs.push({ vapi:'crewsort', date:S.date, names:JSON.stringify(names) });
    (function next(){ var j=jobs.shift(); if(!j){ load(true).then(function(){ say('Отменено'); }); return; } S.o.post(j).then(next,next); })();
  }

  /* ── мышь: перетаскивание блока, растягивание, перестановка людей; щелчок — окно ── */
  function minAt(lane,x,sc){ var r=lane.getBoundingClientRect(), c=cfg(); return Math.round((sc.from+(x-r.left)/r.width*sc.span)/c.snap)*c.snap; }
  function onDown(e){
    S.touch=(e.pointerType==='touch');
    if(S.touch||e.button||S.dlg) return;
    var t=e.target, add=t.getAttribute&&t.getAttribute('data-add'); if(add) return;
    var grip=closest(t,'cb-grip'), blk=closest(t,'cb-blk'), lane=closest(t,'cb-lane'), sc=scale();
    if(grip){ var row=closest(grip,'cb-row'); S.drag={ mode:'row', el:row, y0:e.clientY, moved:false }; row.classList.add('drag'); }
    else if(blk){
      var f=taskBy(blk.getAttribute('data-id')); if(!f) return;
      S.drag={ mode:t.classList.contains('cb-rz')?'rz':'mv', el:blk, id:f.t.id, x0:e.clientX, y0:e.clientY, moved:false, start:f.t.start, dur:f.t.dur, s0:f.t.start, d0:f.t.dur,
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
    var dm=Math.round(dx/g.w*g.sc.span/c.snap)*c.snap;
    if(g.mode==='rz'){ g.dur=Math.max(c.snap,g.d0+dm); g.el.style.width=(g.dur/g.sc.span*100)+'%'; var s=g.el.querySelector('.cb-s, .cb-t2'); if(s&&!g.lbl) g.lbl=s; if(g.lbl) g.lbl.textContent=hm(g.start)+'–'+hm(g.start+g.dur)+' · '+durS(g.dur); return; }
    g.start=Math.max(g.sc.from,Math.min(g.sc.to-c.snap,g.s0+dm)); g.el.style.left=((g.start-g.sc.from)/g.sc.span*100)+'%';
    var lanes=S.el.querySelectorAll('.cb-row .cb-lane');
    for(var k=0;k<lanes.length;k++){ var q=lanes[k].getBoundingClientRect(); if(e.clientY>=q.top&&e.clientY<q.bottom){ if(g.el.parentNode!==lanes[k]){ lanes[k].appendChild(g.el); g.to=lanes[k].getAttribute('data-w'); } break; } }
  }
  function onUp(e){
    window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp);
    var g=S.drag; S.drag=null; if(!g) return;
    if(g.el) g.el.classList.remove('drag');
    if(!g.moved){
      if(g.mode==='new') openAdd(g.lane.getAttribute('data-w'),minAt(g.lane,e.clientX,g.sc));
      else if(g.mode!=='row') openEdit(g.id);
      return;
    }
    if(g.mode==='row'){
      var names=[].map.call(S.el.querySelectorAll('.cb-row'),function(r){ return r.getAttribute('data-w'); });
      if(names.join('|')===people().map(function(p){ return p.name; }).join('|')) return;
      remember(); S.d.people.sort(function(a,b){ return names.indexOf(a.name)-names.indexOf(b.name); });
      send({ vapi:'crewsort', date:S.date, names:JSON.stringify(names) }); return;
    }
    var patch={};
    if(g.mode==='rz'){ if(g.dur===g.d0){ draw(); return; } patch.dur=g.dur; }
    else { if(g.start===g.s0&&g.to===g.from){ draw(); return; } patch.start=g.start; if(g.to!==g.from) patch.to=g.to; }
    remember(); g.el.classList.add('saving');
    send({ vapi:'crewtask', date:S.date, id:g.id, worker:g.from, patch:JSON.stringify(patch) },function(r){ merge(r.rows); });
  }
  // телефон: тап по блоку — окно, тап по пустому месту — добавить
  function onClick(e){
    var t=e.target, add=t.getAttribute&&t.getAttribute('data-add'); if(add){ addHour(add); return; }
    var nm=closest(t,'cb-nm'); if(nm){ openPerson(closest(nm,'cb-row').getAttribute('data-w')); return; }
    if(!S.touch) return;
    var blk=closest(t,'cb-blk'), lane=closest(t,'cb-lane');
    if(blk) openEdit(blk.getAttribute('data-id'));
    else if(lane&&!lane.classList.contains('cb-hours')) openAdd(lane.getAttribute('data-w'),minAt(lane,e.clientX,scale()));
  }
  function onOver(e){
    var blk=closest(e.target,'cb-blk'), k=blk&&blk.getAttribute('data-k'), all=S.el.querySelectorAll('.cb-blk.rel'), i;
    for(i=0;i<all.length;i++) all[i].classList.remove('rel');
    if(!k||k==='|'||S.drag) return;
    all=S.el.querySelectorAll('.cb-blk'); for(i=0;i<all.length;i++) if(all[i]!==blk&&all[i].getAttribute('data-k')===k) all[i].classList.add('rel');
  }
  function onKey(e){
    if(!S.el||!document.body.contains(S.el)||!S.el.querySelector('.cb')) return;
    if(e.key==='Escape'&&S.dlg){ closeDlg(); return; }
    var tag=(e.target&&e.target.tagName)||'';
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
  function dlgErr(t){ var m=$('cbErr'); if(m) m.innerHTML=t?'<span class="err">'+esc(t)+'</span>':''; }

  // добавить работу: одно поле — поиск по работам всех открытых заказов или текст
  function matches(q,p){
    var rows=S.refs||[], words=lc(q).split(/[\s,.]+/).filter(function(w){ return w.length>1; }), home=(p&&p.home)||'';
    var out=rows.filter(function(r){ var t=lc([r.order,r.name,r.eq,r.model,r.detail,r.op,r.group].join(' '));
      return words.every(function(w){ return t.indexOf(w)>=0||(w.length>4&&t.indexOf(w.slice(0,Math.max(4,w.length-2)))>=0); }); });
    if(!words.length) out=out.filter(function(r){ return r.avail>0; });
    out.sort(function(a,b){ return (a.group===home?0:1)-(b.group===home?0:1) || (b.avail>0?1:0)-(a.avail>0?1:0) || b.avail*b.rate-a.avail*a.rate; });
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
  function dlgList(keep){
    var d=S.dlg; if(!d||d.kind!=='add'||d.pick) return;
    if(!keep) d.list=matches($('cbQ').value,person(d.name));
    $('cbList').innerHTML=!S.refs?'<div class="muted cb-li0">список работ загружается…</div>'
      :(d.list.length?d.list.map(function(r,i){
        return '<div class="cb-li'+(i===d.sel?' sel':'')+'" data-i="'+i+'"><span class="cb-dot'+colorOf(r.group)+'"></span>'
          +'<span class="cb-lt"><b>'+esc(r.op)+'</b> · '+esc(r.level==='изделие'?(r.model||r.eq):r.detail)+'<i>'+esc(r.order)+(r.name?' · '+esc(r.name):'')+'</i></span>'
          +'<span class="cb-ln">'+(r.prev?('можно '+qtyS(r.avail)+'<i>осталось '+qtyS(r.left)+'</i>'):('по заказу '+qtyS(r.left)+'<i>первая операция</i>'))+'</span></div>'; }).join('')
        :'<div class="muted cb-li0">'+($('cbQ').value.trim()?'в открытых заказах такого нет — Enter запишет как текст':'сейчас нет работ, которые можно брать сразу, — начните писать')+'</div>');
    var li=$('cbList').querySelectorAll('.cb-li'); for(var i=0;i<li.length;i++) li[i].addEventListener('mousedown',function(e){ e.preventDefault(); pick(+this.getAttribute('data-i')); });
  }
  function pick(i){
    var d=S.dlg, r=d.list[i]; if(!r) return;
    d.pick=r;
    // сколько предложить: что лежит перед операцией, но не больше, чем помещается до следующего блока (или конца дня)
    var c=cfg(), p=person(d.name), end=Math.max(c.to,d.start+60); p.tasks.forEach(function(t){ if(t.start>d.start&&t.start<end) end=t.start; });
    var fit=r.rate>0?Math.floor((end-d.start)/60*c.hourRate*c.efficiency/r.rate):0, have=r.avail>0?r.avail:r.left, q0=fit>0?Math.min(have,fit):have;
    $('cbList').innerHTML='';
    $('cbTip').innerHTML='';
    $('cbPick').innerHTML='<div class="cb-picked"><span class="cb-dot'+colorOf(r.group)+'"></span><span><b>'+esc(r.op)+'</b> · '+esc(r.level==='изделие'?(r.model||r.eq):r.detail)
      +'<i>'+esc(r.order)+' · '+esc(r.group)+' · '+String(r.rate).replace('.',',')+' ₽/шт · '+(r.prev?('можно '+qtyS(r.avail)+', осталось '+qtyS(r.left)):('по заказу осталось '+qtyS(r.left)))+'</i></span></div>'
      +'<div class="cb-f"><label>Количество, шт</label><input id="cbQty" inputmode="decimal" value="'+String(q0).replace('.',',')+'"><span id="cbDur" class="cb-dur"></span></div>'
      +(fit>0&&fit<have?'<div class="cb-hint">до '+hm(end)+' помещается '+qtyS(fit)+' шт</div>':'')
      +'<div class="dlg-btns"><button class="sec" onclick="twCrewBoard._back()">← другая работа</button><button onclick="twCrewBoard._addPicked()">Поставить</button></div>';
    var qi=$('cbQty'), upd=function(){ $('cbDur').textContent='≈ '+durS(calcDur(num(qi.value),r.rate))+durWhy(num(qi.value),r.rate); };
    qi.addEventListener('input',upd); qi.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addPicked(); } }); upd(); qi.focus(); qi.select();
  }
  function back(){ var d=S.dlg; if(!d) return; d.pick=null; $('cbPick').innerHTML=''; $('cbTip').innerHTML='Enter — записать текстом · ↓ и Enter — выбрать работу из списка'; dlgList(); $('cbQ').focus(); }
  function addPicked(){
    var d=S.dlg, r=d&&d.pick; if(!r) return;
    var q=num($('cbQty').value); if(!(q>0)){ dlgErr('Укажите количество'); return; }
    create(d.name,{ op:r.op, detail:r.detail, order:r.order, eq:r.eq, model:r.model, rate:r.rate, qty:q, start:d.start });
  }
  function addText(){ var d=S.dlg, v=$('cbQ').value.trim(); if(!v){ dlgErr('Напишите, что делать, или выберите работу'); return; } create(d.name,{ title:v, start:d.start }); }
  function create(name,patch){ closeDlg(); remember(); send({ vapi:'crewtask', date:S.date, worker:name, patch:JSON.stringify(patch) },function(r){ merge(r.rows); }); }

  // блок: количество, время, кому, удалить
  function openEdit(id){
    var f=taskBy(id); if(!f) return; var t=f.t, free=!t.op, h=hintOf(t);
    var opts=people().map(function(p){ return '<option'+(p.name===f.p.name?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('');
    openDlg('edit',(free?('<div class="cb-f"><label>Что делать</label><input id="cbTitle" value="'+esc(t.title)+'"></div>')
        :('<div class="cb-picked"><span class="cb-dot'+colorOf(t.group)+'"></span><span><b>'+esc(t.op)+'</b>'+(t.detail?' · '+esc(t.detail):(t.model?' · '+esc(t.model):''))
          +'<i>'+esc([t.order,t.group,t.rate?String(t.rate).replace('.',',')+' ₽/шт':''].filter(Boolean).join(' · '))+'</i></span></div>'
          +'<div class="cb-f"><label>Количество, шт</label><input id="cbQty" inputmode="decimal" value="'+String(t.qty).replace('.',',')+'"><span id="cbDur" class="cb-dur"></span></div>'))
      +'<div class="cb-f"><label>Время</label><input type="time" id="cbFrom" step="900" value="'+hm2(t.start)+'"><span>—</span><input type="time" id="cbTo" step="900" value="'+hm2(t.start+t.dur)+'">'
        +(free?'':'<button class="gho sm" id="cbAuto" title="поставить длину по расчёту из количества и расценки">по расчёту</button>')+'</div>'
      +'<div class="cb-f"><label>Кому</label><select id="cbWho">'+opts+'</select></div>'
      +(h?'<div class="cb-hint'+(h.warn?' warn':'')+'">'+esc(hintText(t,h))+'</div>':'')+(t.done>0?'<div class="cb-hint ok">сдано нарядами: '+qtyS(t.done)+' из '+qtyS(t.qty)+' шт</div>':'')
      +'<div id="cbErr"></div><div class="dlg-btns"><button class="sec danger" onclick="twCrewBoard._del()">Удалить</button><span class="cb-sp"></span>'
      +'<button class="sec" onclick="twCrewBoard._close()">Отмена</button><button onclick="twCrewBoard._save()">Сохранить</button></div>',{ id:id, auto:false });
    var qi=$('cbQty');
    if(qi){ var upd=function(){ var m=calcDur(num(qi.value),t.rate); $('cbDur').textContent='по расчёту '+durS(m)+durWhy(num(qi.value),t.rate); if(S.dlg.auto||!t.manual) setEnd(m); };
      qi.addEventListener('input',upd); $('cbDur').textContent='по расчёту '+durS(t.calc)+durWhy(t.qty,t.rate);
      $('cbAuto').addEventListener('click',function(){ S.dlg.auto=true; setEnd(calcDur(num(qi.value),t.rate)); }); }
    $('cbTo').addEventListener('input',function(){ S.dlg.auto=false; S.dlg.touched=true; });
    S.dlg.bg.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){ e.preventDefault(); saveEdit(); } });
    (qi||$('cbTitle')).focus();
  }
  function tm(v){ var m=/^(\d{1,2}):(\d{2})/.exec(v||''); return m?(+m[1])*60+(+m[2]):null; }
  function setEnd(dur){ var a=tm($('cbFrom').value); if(a!=null) $('cbTo').value=hm2(a+dur); }
  function saveEdit(){
    var d=S.dlg, f=d&&taskBy(d.id); if(!f) return closeDlg(); var t=f.t, patch={}, a=tm($('cbFrom').value), b=tm($('cbTo').value);
    if(a==null||b==null){ dlgErr('Укажите время начала и конца'); return; }
    if(b<=a) b+=1440;   // конец после полуночи
    if($('cbTitle')){ var v=$('cbTitle').value.trim(); if(!v){ dlgErr('Напишите, что делать'); return; } if(v!==t.title) patch.title=v; }
    if($('cbQty')){ var q=num($('cbQty').value); if(!(q>0)){ dlgErr('Укажите количество'); return; } if(q!==t.qty) patch.qty=q; }
    if(a!==t.start) patch.start=a;
    if(d.auto) patch.auto=true; else if(b-a!==t.dur&&(d.touched||patch.qty==null||t.manual)) patch.dur=b-a;
    var to=$('cbWho').value; if(to!==f.p.name) patch.to=to;
    closeDlg(); if(!Object.keys(patch).length) return;
    remember(); send({ vapi:'crewtask', date:S.date, id:t.id, worker:f.p.name, patch:JSON.stringify(patch) },function(r){ merge(r.rows); });
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
    openDlg('addp','<div class="cb-dh"><b>Добавить на '+dmy(S.date)+'</b> · поставит 1-ю смену в табеле</div><input id="cbPQ" autocomplete="off" placeholder="фамилия"><div class="cb-list" id="cbPL"></div>'
      +'<div class="dlg-btns"><span class="cb-sp"></span><button onclick="twCrewBoard._close()">Готово</button></div>',{ added:{} });
    var q=$('cbPQ'), drawL=function(){ var d=S.dlg; if(!d||d.kind!=='addp') return;
      var v=lc(q.value), l=((S.d&&S.d.rest)||[]).filter(function(n){ return !d.added[n]&&lc(n).indexOf(v)>=0; });
      $('cbPL').innerHTML=l.length?l.map(function(n){ return '<div class="cb-li" data-n="'+esc(n)+'"><span class="cb-lt"><b>'+esc(n)+'</b></span><span class="cb-ln">＋</span></div>'; }).join(''):'<div class="muted cb-li0">'+(v?'никого не нашлось':'все уже на доске')+'</div>';
      var li=$('cbPL').querySelectorAll('.cb-li'); for(var i=0;i<li.length;i++) li[i].addEventListener('click',function(){ var n=this.getAttribute('data-n'); d.added[n]=1; q.value=''; drawL(); q.focus();
        send({ vapi:'planset', date:ruD(S.date), worker:n, patch:JSON.stringify({ shift:'день' }) },function(){ load(true); }); }); };
    q.addEventListener('input',drawL); drawL(); q.focus();
  }
  function carry(){ remember(); send({ vapi:'crewcarry', date:S.date },function(r){ if(r.added){ merge(r.rows); say('Перенесено с '+dmy(r.from)+': '+r.added+(r.noShift?' · не перенесено '+r.noShift+' — человек сегодня не в смене':'')); }
    else { S.undo.pop(); drawActions(); say(r.from?('С '+dmy(r.from)+' переносить нечего'+(r.noShift?' ('+r.noShift+' не перенесено — человек сегодня не в смене)':'')):'За прошлую неделю заданий не было'); } }); }

  var wired=false;
  window.twCrewBoard={
    mount:function(el,o){
      S.el=el; S.o=o; S.date=o.date; S.d=null; S.undo=[]; S.msg='';
      el.innerHTML='<div class="center muted">Загрузка…</div>';
      if(!el._cb){ el._cb=1; el.addEventListener('pointerdown',onDown); el.addEventListener('click',onClick); el.addEventListener('mouseover',onOver); }
      if(!wired){ wired=true; document.addEventListener('keydown',onKey); }
      // шрифт темы догружается после первой отрисовки — имена перемерить ещё раз
      try{ if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ if(S.d) fitNames(); }); }catch(e){}
      return load();
    },
    setDate:function(d){ S.date=d; S.undo=[]; return load(); },
    reload:function(){ return load(true); },
    undo:undo, addPerson:addPerson, carry:carry, sendAll:sendAll,
    _help:function(){ S.help=!S.help; draw(); }, _back:back, _addPicked:addPicked, _save:saveEdit, _del:delEdit, _close:closeDlg, _shift:setShift, _remove:removePerson, _sendOne:sendOne
  };
})();
