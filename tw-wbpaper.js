/* Накладная с бумаги (владелец 15.11.2026): бухгалтер загружает скан НАШЕЙ уже выписанной ТН/ТТН — система распознаёт бланк, получателя
   и строки, показывает, куда запишет (заказы клиента / передача переработчику / возврат клиенту / возврат поставщику), и после проверки
   записывает накладную под тем же бланком: долг клиента — по сумме с бумаги, отгрузка по заказам, книга бланков. Сервер: wbpaperscan → wbpaperctx → wbpapersave.
   Ждёт от страницы: get, post, run, ask, hide, info, oops, errText, el, val, esc, setm, money. twWbPaper(onDone). */
var TWP=null;
var TWP_PURP=[['sale','Продажа клиенту'],['give','Передача переработчику (ДП)'],['return','Возврат клиенту (ДВ)'],['supplier_return','Возврат поставщику (ВП)']];
function twWbPaper(onDone){
  ask('📄 Накладная с бумаги', '<div class="sm">Скан или фото нашей выписанной ТН / ТТН. Система прочитает бланк, получателя и строки и покажет, куда запишет накладную. '
    +'Ничего не сохранится, пока вы не нажмёте «Записать».</div>'
    +'<label style="display:block;margin-top:var(--s-3)"><span class="sm">Файл (PDF или фото, до 15 МБ)</span><input type="file" id="twpf" accept="application/pdf,image/*" style="width:100%"></label><div class="msg" id="twpm"></div>',
    function(){
      var f=el('twpf').files[0];
      if(!f){ setm('twpm','err','Выберите файл'); return false; }
      if(f.size>15*1024*1024){ setm('twpm','err','Файл больше 15 МБ — сожмите фото или сохраните PDF'); return false; }
      var rd=new FileReader();
      rd.onload=function(){ var file={b64:String(rd.result).split(',')[1]||'', name:f.name||'', mime:f.type||''};
        run({vapi:'wbpaperscan', b64:file.b64, name:file.name, mime:file.mime}, 'Читаю накладную… до минуты', 'twpm').then(function(r){
          if(!r) return; TWP=r; TWP.file=file; TWP.onDone=onDone; TWP.lines=r.lines||[]; TWP.lines.forEach(function(p){ p.up=twpN(p.qty)?Math.round(twpN(p.sum)/twpN(p.qty)*10000)/10000:twpN(p.price); }); twpDraw(); }); };
      rd.onerror=function(){ setm('twpm','err','Не удалось прочитать файл'); };
      rd.readAsDataURL(f); return false;
    }, 'Распознать');
}
function twpN(v){ return Number(String(v==null?'':v).replace(/\s/g,'').replace(',','.'))||0; }
function twpQ(n){ n=Math.round((Number(n)||0)*1000)/1000; return String(n).replace('.',','); }
/* бланк: что будет при записи */
function twpBlank(){
  var b=TWP.blank||{}, s=b.state;
  if(s==='free') return '<span class="pill ok">свободен</span>';
  if(s==='reserved') return '<span class="pill warn">в резерве</span> <span class="sm muted">резерв снимется — бумага уже выписана</span>';
  if(s==='absent') return '<span class="pill info">нет в книге</span> <span class="sm muted">добавится в книгу бланков при записи</span>';
  if(s==='spoiled') return '<span class="pill bad">в книге испорчен</span> <span class="sm">проверьте серию и номер на бумаге</span>';
  if(s==='used') return '<span class="pill bad">уже выписан</span>';
  return '';
}
function twpDup(){
  var b=TWP.blank||{}, d=b.doc; if(b.state!=='used') return '';
  return '<div class="note warn"><div>⚠ Бланк <b>'+esc(b.label)+'</b> уже выписан в Прохабе'+(d?': '+esc(d.client)+', '+esc(d.date)+', '+money(d.sum)+' руб.'+(d.order?' · '+esc(d.order):'')+(d.signed?' · подписана':''):'')+'. '
    +'Скорее всего, это та же накладная. '+(d&&d.url?'<a href="'+esc(d.url)+'" target="_blank" rel="noopener">Открыть ↗</a> · ':'')
    +(d&&!d.signed?'<a href="#" onclick="twpAttach();return false"><b>Приложить этот скан как подписанный</b></a>':'')+'</div></div>';
}
function twpDraw(){
  var h=TWP.head||{}, cp=TWP.cp, pu=TWP.purpose||'sale', ctx=TWP.ctx||{};
  var top='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--s-2) var(--s-3)">'
    +'<label><span class="sm">Вид</span><select id="twpk" onchange="twpHead()"><option'+(h.kind==='ТН'?' selected':'')+'>ТН</option><option'+(h.kind==='ТТН'?' selected':'')+'>ТТН</option></select></label>'
    +'<label><span class="sm">Бланк: серия и №</span><span style="display:flex;gap:6px"><input id="twps" value="'+esc(h.series)+'" style="width:4.5em" onchange="twpHead()"><input id="twpn" value="'+esc(h.number)+'" inputmode="numeric" style="flex:1;min-width:0" onchange="twpHead()"></span></label>'
    +'<label><span class="sm">Дата накладной</span><input id="twpd" value="'+esc(h.date)+'" placeholder="дд.мм.гггг"></label>'
    +'<label><span class="sm">Получатель (УНП или название)</span><span style="display:flex;gap:6px"><input id="twpc" value="'+esc(cp?(cp.taxId||cp.name):(h.recipientUnp||h.recipient))+'" style="flex:1;min-width:0"><button class="sec sm" onclick="twpFind();return false">Найти</button></span></label>'
    +'</div>'
    +'<div class="sm" style="margin-top:var(--s-2)">Бланк: '+twpBlank()+' · Получатель: '+(cp?'<b>'+esc(cp.name)+'</b>':'<span class="pill bad">не найден</span> <span class="sm">на бумаге: '+esc(h.recipient||'—')+(h.recipientUnp?', УНП '+esc(h.recipientUnp):'')+'</span>')+'</div>'
    +twpDup()
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--s-2) var(--s-3);margin-top:var(--s-2)">'
    +'<label><span class="sm">Основание отпуска</span><input id="twpb" value="'+esc(h.basis)+'"></label>'
    +'<label><span class="sm">Пункт разгрузки (ТТН)</span><input id="twpa" value="'+esc(h.address)+'"></label></div>'
    +'<label class="sm" style="display:flex;gap:6px;align-items:center;margin-top:var(--s-2)"><input type="checkbox" id="twpsg"'+(h.signed?' checked':'')+'> получатель расписался — накладная сразу «подписана»</label>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s-3)">'+TWP_PURP.map(function(p){ return '<button class="chip'+(p[0]===pu?' on':'')+'" onclick="twpPurpose(\''+p[0]+'\');return false">'+p[1]+'</button>'; }).join('')+'</div>';
  var body=(TWP.blank||{}).state==='used'?'':!cp?'<div class="note warn"><div>Получатель не найден в справочнике — впишите его УНП или название и нажмите «Найти».</div></div>'
    : pu==='sale'?twpSale(ctx): pu==='give'?twpGive(): pu==='return'?twpReturn(ctx): twpSupRet(ctx);
  ask('📄 '+esc(h.kind||'ТН')+' '+esc((h.series||'')+' '+(h.number||''))+' — с бумаги', top+'<div id="twpbody" style="margin-top:var(--s-3)">'+body+'</div><div class="msg" id="twpm2"></div>', twpSave, 'Записать накладную');
  var d=el('askmodal').querySelector('.dlg'); if(d) d.className='dlg lg';
  twpSaveState();
}
function twpSaveState(){ var b=el('askOk'), bad=(TWP.blank&&(TWP.blank.state==='used'||TWP.blank.state==='spoiled'))||!TWP.cp||(TWP.purpose==='sale'&&twpShort()>0);
  if(b){ b.disabled=!!bad; b.title=bad?'Сначала устраните то, что подсвечено':''; } }
/* сменили вид / бланк / получателя — пересчитать на сервере */
function twpCtx(cpKey){
  var h=TWP.head; h.kind=val('twpk')||h.kind; h.series=val('twps'); h.number=val('twpn'); h.date=val('twpd')||h.date; h.basis=val('twpb'); h.address=val('twpa'); h.signed=!!(el('twpsg')||{}).checked;
  return get({vapi:'wbpaperctx', purpose:TWP.purpose, cp:cpKey!=null?cpKey:(TWP.cp?TWP.cp.id:''), lines:JSON.stringify(TWP.lines), basis:h.basis, kind:h.kind, series:h.series, number:h.number}).then(function(r){
    if(!r||!r.ok){ oops(errText(r)); return; }
    if(r.blank) TWP.blank=r.blank; TWP.cp=r.cp||TWP.cp; TWP.ctx=r.ctx||{}; twpDraw(); }, function(e){ oops('Связь оборвалась: '+((e&&e.message)||e)); });
}
function twpHead(){ twpCtx(); }
function twpFind(){ var k=val('twpc').trim(); if(!k) return; twpCtx(k); }
function twpPurpose(p){ TWP.purpose=p; twpCtx(); }

/* ── продажа: строки бумаги → строки заказов клиента ── */
function twpOpen(){ var o=[]; ((TWP.ctx||{}).deals||[]).forEach(function(d){ (d.lines||[]).forEach(function(l){ o.push({id:l.id, deal:d.dealId, num:d.num, date:d.date, name:l.name, sku:l.sku, price:l.price, left:l.left}); }); }); return o; }
function twpShort(){ var s=0; ((TWP.ctx||{}).alloc||[]).forEach(function(a,i){ var p=TWP.lines[i]||{}, got=0; (a.take||[]).forEach(function(t){ got+=twpN(t.qty); }); s+=Math.max(0, Math.round((twpN(p.qty)-got)*1000)/1000); }); return s; }
function twpSale(ctx){
  var open=twpOpen(), alloc=ctx.alloc||[], ours=0, paper=0, short=[];
  var opt=function(sel){ return '<option value="">— не из заказа —</option>'+open.map(function(o){ return '<option value="'+esc(o.id)+'"'+(o.id===sel?' selected':'')+'>'+esc(o.num+' от '+o.date+' · '+(o.sku?o.sku+' ':'')+o.name+' · осталось '+twpQ(o.left)+' · '+money(o.price))+'</option>'; }).join(''); };
  var rows=TWP.lines.map(function(p,i){
    var a=alloc[i]||{take:[]}; if(!a.take) a.take=[]; paper+=twpN(p.sum);
    var got=0; a.take.forEach(function(t){ got+=twpN(t.qty); ours+=twpN(t.qty)*twpN(t.price); });
    var sh=Math.max(0, Math.round((twpN(p.qty)-got)*1000)/1000); if(sh>0) short.push(p.name+' — '+twpQ(sh)+' шт');
    var unit=twpN(p.qty)?twpN(p.sum)/twpN(p.qty):0, diff=a.take.length&&Math.abs(unit-twpN(a.take[0].price))>0.01;
    return '<tr><td data-l="С бумаги"><b>'+esc(p.name)+'</b><div class="sub2">'+twpQ(p.qty)+' '+esc(p.unit||'шт.')+' × '+money(unit)+' = '+money(p.sum)+(diff?' · <span style="color:var(--amber)">в заказе '+money(a.take[0].price)+' за шт.</span>':'')+'</div></td>'
      +'<td data-l="В заказ">'+a.take.map(function(t,k){ return '<div style="display:flex;gap:6px;margin-bottom:4px"><select style="flex:1;min-width:0" onchange="twpTake('+i+','+k+',this.value)">'+opt(t.id)+'</select><input type="number" min="0" step="any" value="'+twpN(t.qty)+'" style="width:5.5em" onchange="twpTakeQ('+i+','+k+',this.value)"></div>'; }).join('')
      +(sh>0?'<div class="sm" style="color:var(--red)">не нашлось в заказах: '+twpQ(sh)+' шт. · <a href="#" onclick="twpAdd('+i+');return false">выбрать заказ</a></div>':'')+'</td></tr>';
  }).join('');
  var warn=short.length?'<div class="note warn"><div>⚠ Этого нет в открытых заказах клиента: '+esc(short.join('; '))+'. Накладную как продажу записать нельзя — сначала оформите продажу на недостающее'
    +(typeof twNewSale==='function'&&TWP.cp?' <button class="sec sm" onclick="hide(\'askmodal\');twNewSale('+esc(JSON.stringify(TWP.cp.id))+')">＋ Продажа</button>':'')+', затем загрузите накладную снова. Если это возврат или передача материала — выберите вид выше.</div></div>':'';
  var dif=Math.round((paper-ours)*100)/100;
  return warn+'<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Строка накладной</th><th>Заказ клиента · сколько</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="sm" style="margin-top:var(--s-2)">Долг клиента запишется <b>по бумаге: '+money(TWP.head.total||paper)+' руб.</b>'+(ours&&Math.abs(dif)>0.01?' · по ценам заказов '+money(ours)+' — разница <b style="color:var(--amber)">'+money(dif)+'</b>.':'')+' Заказ, который уедет целиком, станет «отгружен».</div>';
}
function twpTake(i,k,id){ var a=TWP.ctx.alloc[i], o=twpOpen().filter(function(x){ return x.id===id; })[0];
  if(!o){ a.take.splice(k,1); } else { var t=a.take[k]; t.id=o.id; t.deal=o.deal; t.num=o.num; t.price=o.price; } twpRedraw(); }
function twpTakeQ(i,k,v){ TWP.ctx.alloc[i].take[k].qty=Math.max(0,twpN(v)); twpRedraw(); }
function twpAdd(i){ var a=TWP.ctx.alloc[i], got=0; a.take.forEach(function(t){ got+=twpN(t.qty); }); a.take.push({id:'', deal:'', num:'', price:0, qty:Math.max(0,twpN(TWP.lines[i].qty)-got)}); twpRedraw(); }
function twpRedraw(){ var p=TWP.purpose, c=TWP.ctx||{}; el('twpbody').innerHTML=p==='sale'?twpSale(c):p==='give'?twpGive():p==='return'?twpReturn(c):twpSupRet(c); twpSaveState(); }

/* ── передача / возврат клиенту / возврат поставщику: строки текстом ── */
function twpLineInputs(i, p, extra){
  return '<tr><td data-l="Строка"><input value="'+esc(p.name)+'" onchange="TWP.lines['+i+'].name=this.value" style="width:100%"></td>'
    +'<td data-l="Кол-во"><input type="number" step="any" min="0" value="'+twpN(p.qty)+'" style="width:6em" onchange="TWP.lines['+i+'].qty=twpN(this.value);twpRedraw()"> '+esc(p.unit||'')+'</td>'
    +'<td data-l="Цена за ед.">'+money(p.up)+'</td>'+(extra||'')+'</tr>';
}
function twpGive(){
  return '<div class="sm muted" style="margin-bottom:var(--s-2)">Передача переработчику (ДП-N): материал остаётся нашим, вернётся его накладной. Строки — как на бумаге.</div>'
    +'<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Строка</th><th>Кол-во</th><th>Цена</th></tr></thead><tbody>'+TWP.lines.map(function(p,i){ return twpLineInputs(i,p); }).join('')+'</tbody></table></div>';
}
function twpReturn(ctx){
  var ins=ctx.intakes||[]; if(!ins.length) return '<div class="note warn"><div>У этого клиента нет открытого приёма давальческого сырья — возврат записать не к чему.</div></div>';
  TWP.intake=TWP.intake||ins[0].id; var cur=ins.filter(function(x){ return x.id===TWP.intake; })[0]||ins[0], map=ctx.map||[];
  var opts=function(k){ return '<option value="-1"'+(k<0?' selected':'')+'>продукция</option>'+cur.lines.map(function(l){ return '<option value="'+l.k+'"'+(l.k===k?' selected':'')+'>остаток сырья: '+esc(l.name)+' (на руках '+twpQ(l.left)+')</option>'; }).join(''); };
  return '<div style="display:flex;gap:var(--s-3);flex-wrap:wrap;margin-bottom:var(--s-2)"><label><span class="sm">Приём сырья</span><select onchange="TWP.intake=this.value;TWP.lines.forEach(function(l){ l.srcLine=-1; });twpRedraw()">'+ins.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===cur.id?' selected':'')+'>'+esc(x.number+' · накладная '+x.docNo+' от '+x.date)+'</option>'; }).join('')+'</select></label>'
    +'<label><span class="sm">Сделка (работы)</span><select id="twpdeal"><option value="">—</option>'+(ctx.deals||[]).map(function(d){ return '<option value="'+esc(d.id)+'">'+esc(d.num)+'</option>'; }).join('')+'</select></label></div>'
    +'<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Строка</th><th>Кол-во</th><th>Цена</th><th>Что это</th></tr></thead><tbody>'
    +TWP.lines.map(function(p,i){ var k=p.srcLine!=null?p.srcLine:(map[i]!=null?map[i]:-1); p.srcLine=k; return twpLineInputs(i,p,'<td data-l="Что это"><select onchange="TWP.lines['+i+'].srcLine=Number(this.value)">'+opts(k)+'</select></td>'); }).join('')+'</tbody></table></div>';
}
function twpSupRet(ctx){
  var docs=ctx.docs||[]; if(!docs.length) return '<div class="note warn"><div>У поставщика нет разнесённых входящих накладных, по которым есть что вернуть.</div></div>';
  TWP.doc=TWP.doc||docs[0].id; var cur=docs.filter(function(x){ return x.id===TWP.doc; })[0]||docs[0], map=ctx.map||[];
  var opts=function(id){ return '<option value="">— не выбрано —</option>'+cur.lines.filter(function(l){ return l.can; }).map(function(l){ return '<option value="'+esc(l.id)+'"'+(l.id===id?' selected':'')+'>'+esc(l.name+' · можно вернуть '+twpQ(l.left)+' '+l.unit)+'</option>'; }).join(''); };
  return '<label><span class="sm">Входящая накладная поставщика</span><select onchange="TWP.doc=this.value;TWP.lines.forEach(function(l){ delete l.lineId; });twpRedraw()" style="margin-bottom:var(--s-2)">'+docs.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===cur.id?' selected':'')+'>'+esc('№ '+x.docNo+' от '+x.date+' · '+money(x.sum))+'</option>'; }).join('')+'</select></label>'
    +'<div class="sm muted" style="margin-bottom:var(--s-2)">Долг поставщику и количество материала уменьшатся на возвращённое (цены — из его накладной).</div>'
    +'<div class="tbl-wrap"><table class="tbl sm mob"><thead><tr><th>Строка</th><th>Кол-во</th><th>Цена</th><th>Строка его накладной</th></tr></thead><tbody>'
    +TWP.lines.map(function(p,i){ var id=p.lineId!=null?p.lineId:(cur.id===docs[0].id?map[i]||'':''); p.lineId=id; return twpLineInputs(i,p,'<td data-l="Его строка"><select onchange="TWP.lines['+i+'].lineId=this.value">'+opts(id)+'</select></td>'); }).join('')+'</tbody></table></div>';
}

/* ── запись ── */
function twpSave(){
  var h=TWP.head, pu=TWP.purpose, lines;
  if(pu==='sale'){ lines=[]; (TWP.ctx.alloc||[]).forEach(function(a){ (a.take||[]).forEach(function(t){ if(t.id&&twpN(t.qty)>0) lines.push({id:t.id, qty:twpN(t.qty)}); }); }); }
  else if(pu==='supplier_return') lines=TWP.lines.map(function(p){ return {lineId:p.lineId||'', qty:twpN(p.qty)}; });
  else lines=TWP.lines.map(function(p){ return {name:p.name, unit:p.unit, qty:twpN(p.qty), price:p.up, places:p.places, mass:p.mass, srcLine:pu==='return'?p.srcLine:undefined}; });
  var data={purpose:pu, kind:val('twpk'), series:val('twps'), number:val('twpn'), date:val('twpd'), cp:TWP.cp?TWP.cp.id:'', basis:val('twpb'), address:val('twpa'), signed:!!el('twpsg').checked,
    total:h.total, transport:{car:h.car||'', driver:h.driver||'', waybillDoc:h.waybillDoc||''}, recognized:{head:h, lines:TWP.lines}, lines:lines,
    intakeId:TWP.intake||'', dealId:val('twpdeal'), doc:TWP.doc||''};
  run({vapi:'wbpapersave', data:JSON.stringify(data), b64:TWP.file.b64, name:TWP.file.name, mime:TWP.file.mime}, 'Записываю накладную…', 'twpm2').then(function(r){
    if(!r) return; hide('askmodal');
    info('✅ Накладная записана', '<div><b>'+esc(data.kind+' '+(r.blank||''))+'</b>'+(r.number?' · '+esc(r.number):'')+' от '+esc(data.date)+'.</div>'
      +'<div class="sm" style="margin-top:var(--s-2)">'+(pu==='sale'?'Отгрузка по заказам и долг клиента учтены, бланк — в книге.':'Запись и бланк — в реестре накладных.')+(r.url?' <a href="'+esc(r.url)+'" target="_blank" rel="noopener">Скан ↗</a>':'')+'</div>');
    if(TWP.onDone) TWP.onDone(r);
  });
  return false;
}
function twpAttach(){
  var d=(TWP.blank||{}).doc; if(!d) return;
  run({vapi:'wbsign', id:d.id, b64:TWP.file.b64, name:TWP.file.name, mime:TWP.file.mime, date:val('twpd')}, 'Прикладываю скан…', 'twpm2').then(function(r){
    if(!r) return; hide('askmodal'); info('✅ Скан приложен', '<div>Накладная '+esc(TWP.blank.label)+' — «подписана».</div>'); if(TWP.onDone) TWP.onDone(r); });
}
