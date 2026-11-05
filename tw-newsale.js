/* Единое окно «＋ Новая продажа» (05.11.2026; владелец: «куда нажать — сделку или счёт?»). Клиент → система сама предлагает путь:
   действует рамочный → счёт по нему (bill.html?contract= ; Европа — invoice.html); нет — договор (contract.html?contract=new&client=), ЮЛ — ещё рамочный;
   открытые сделки клиента (ЮЛ) → счёт к сделке (bill.html?deal=). Одно и то же окно из «Сделки», «Счета» и карточки клиента.
   Ждёт от страницы: get(p) — чтение vapi (buyers, contractkinds, dealslist). Диалог — свой, на .dlg-bg/.dlg темы (как tw-payroll.js). ES5.
   twNewSale(presetKey?) — открыть; с ключом клиента (УНП / ИНН / ID) шаг выбора клиента пропускается. */
(function(){
  var S={ buyers:null, deals:null, b:null };
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  /* адрес страницы с сохранением служебных параметров (tok, embed…), без ключей других экранов */
  function url(page, params){ var sp=new URLSearchParams(location.search); ['deal','lead','client','contract','framework','tab','restore','back','new','type','name','role','invoice','batch'].forEach(function(x){ sp.delete(x); });
    for(var k in params) if(params[k]!=null&&params[k]!=='') sp.set(k, params[k]); return page+'?'+sp.toString(); }
  function name(b){ return String(b['Наименование ЮЛ (полное)']||b['Полное ФИО']||'').trim(); }
  function key(b){ return String(b['УНП']||b['ИНН']||b['ID']||'').trim(); }
  function person(b){ return /физ/i.test(String(b['Тип']||'')); }
  function typeRu(b){ return person(b)?'физлицо':(String(b['Тип']||'')==='ИП'?'ИП':'юрлицо'); }
  function dlg(){ var bg=document.getElementById('twnsDlg');
    if(!bg){ bg=document.createElement('div'); bg.id='twnsDlg'; bg.className='dlg-bg'; bg.style.display='none'; bg.setAttribute('role','dialog'); bg.setAttribute('aria-modal','true');
      bg.innerHTML='<div class="dlg md"></div>'; bg.addEventListener('click',function(e){ if(e.target===bg) close(); }); document.body.appendChild(bg); }
    return bg; }
  function close(){ var bg=document.getElementById('twnsDlg'); if(bg) bg.style.display='none'; }
  function box(h){ var bg=dlg(); bg.querySelector('.dlg').innerHTML='<h3>＋ Новая продажа <span class="x" onclick="twNewSale.close()" title="закрыть">×</span></h3>'+h; bg.style.display='flex'; }
  function load(){ return S.buyers?Promise.resolve(S.buyers):get({vapi:'buyers'}).then(function(r){ S.buyers=(r&&r.buyers)||[]; return S.buyers; }); }
  function dealsOf(){ return S.deals?Promise.resolve(S.deals):get({vapi:'dealslist'}).then(function(r){ S.deals=(r&&r.deals)||[]; return S.deals; }); }
  /* шаг 1: клиент */
  function step1(){
    box('<div class="sm" style="margin-bottom:var(--s-2)">Выберите клиента — дальше система сама предложит, что оформлять: счёт по рамочному договору, новый договор или счёт к открытой сделке.</div>'
      +'<input id="twnsQ" list="twnsList" placeholder="🔎 клиент: название, ФИО или УНП" autocomplete="off" oninput="twNewSale._pick(this.value)" onchange="twNewSale._pick(this.value)"><datalist id="twnsList"></datalist>'
      +'<div id="twnsHint" class="sm muted" style="margin-top:var(--s-2)">загружаю справочник…</div>'
      +'<div class="dlg-btns"><a class="btn sec" href="'+esc(url('counterparties.html',{new:'1'}))+'" title="сначала карточка клиента, потом продажа">＋ Создать клиента</a><button class="sec" onclick="twNewSale.close()">Отмена</button></div>');
    load().then(function(bs){ var dl=document.getElementById('twnsList'); if(!dl) return;
      dl.innerHTML=bs.map(function(b){ return '<option value="'+esc(name(b))+'">'+esc(key(b))+' · '+typeRu(b)+'</option>'; }).join('');
      var h=document.getElementById('twnsHint'); if(h) h.textContent='клиентов в справочнике: '+bs.length;
      var q=document.getElementById('twnsQ'); if(q) q.focus(); });
  }
  function pick(v){ var k=String(v||'').trim().toLowerCase(); if(!k||!S.buyers) return; var b=null;
    for(var i=0;i<S.buyers.length;i++){ var x=S.buyers[i]; if(name(x).toLowerCase()===k||(key(x)&&key(x).toLowerCase()===k)){ b=x; break; } }
    if(b) step2(b); }
  /* шаг 2: что оформлять */
  function step2(b){ S.b=b; var k=key(b);
    box('<div><b>'+esc(name(b))+'</b> <span class="pill">'+typeRu(b)+'</span>'+(k?' <span class="sm muted">'+esc(k)+'</span>':'')+(k?' · <a href="'+esc(url('counterparties.html',{client:k}))+'">карточка →</a>':'')+'</div>'
      +'<div id="twnsWays" class="sm" style="margin-top:var(--s-3)">смотрю договоры и сделки клиента…</div>'
      +'<div class="dlg-btns"><button class="sec" onclick="twNewSale._back()">← другой клиент</button><button class="sec" onclick="twNewSale.close()">Отмена</button></div>');
    Promise.all([get({vapi:'contractkinds', key:k}), dealsOf()]).then(function(rs){ ways(b, rs[0]||{}, rs[1]||[]); }).catch(function(){ ways(b, {}, []); });
  }
  function ways(b, kinds, deals){
    var k=key(b), fws=kinds.activeFrameworks||[], retail=person(b)||/физ/i.test(kinds.clientType||''), h='';
    var open=deals.filter(function(d){ return d.buyerKey===k && (d.stage==='inquiry'||d.stage==='order'); });
    var eu=function(f){ return f.kind==='supply_eu'||f.kind==='services_eu'; }, hasSupplyFw=fws.some(function(f){ return /^supply/.test(f.kind||''); });   // переработка/услуги не заменяют рамочный поставки
    if(fws.length){ h+='<div class="note ok"><div>У клиента уже действует договор на клиента — поставка или работы по нему оформляются <b>счётом</b>, новый договор для этого не нужен.</div></div>'
      +fws.map(function(f){ return '<a class="btn" style="margin:var(--s-1) var(--s-1) 0 0" href="'+esc(eu(f)?url('invoice.html',{invoice:'new',contract:f.id}):url('bill.html',{contract:f.id}))+'">🧾 Счёт по договору № '+esc(f.number)+'</a>'
        +'<div class="sm muted" style="margin:2px 0 var(--s-2)">'+esc(f.type||'рамочный')+(f.validUntil?' · до '+esc(f.validUntil):'')+'</div>'; }).join(''); }
    h+='<div style="margin-top:var(--s-3)"><div class="sm muted" style="margin-bottom:var(--s-1)">'+(fws.length?'Другой путь — отдельный договор:':'Договор:')+'</div>'
      +'<a class="btn'+(fws.length?' sec':'')+'" style="margin:0 var(--s-1) var(--s-1) 0" href="'+esc(url('contract.html',{contract:'new',client:k}))+'">📄 '+(retail?'Договор с покупателем':'Разовый договор поставки')+'</a>'
      +(retail||hasSupplyFw?'':'<a class="btn sec" style="margin:0 var(--s-1) var(--s-1) 0" href="'+esc(url('contract.html',{contract:'new',client:k,framework:'1'}))+'" title="на год, без суммы; каждая поставка — отдельным счётом">📑 Рамочный договор</a>')+'</div>';
    if(open.length && !retail) h+='<div style="margin-top:var(--s-3)"><div class="sm muted" style="margin-bottom:var(--s-1)">Или счёт к открытой сделке клиента:</div>'
      +open.slice(0,8).map(function(d){ return '<a class="btn sec sm" style="margin:0 var(--s-1) var(--s-1) 0" href="'+esc(url('bill.html',{deal:d.id}))+'">'+esc(d.num||d.inquiryNum||'')+' · '+esc(d.stageRu||d.stage)+(d.sum?' · '+esc(d.sum)+' '+esc(d.currency||''):'')+'</a>'; }).join('')+'</div>';
    var w=document.getElementById('twnsWays'); if(w) w.innerHTML=h;
  }
  window.twNewSale=function(presetKey){
    if(presetKey){ load().then(function(bs){ for(var i=0;i<bs.length;i++) if(key(bs[i])===String(presetKey)) return step2(bs[i]); step1(); }); }
    else step1();
  };
  window.twNewSale.close=close; window.twNewSale._pick=pick; window.twNewSale._back=step1;
})();
