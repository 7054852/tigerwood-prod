/* Редактор позиций продажи (бриф 30.09.2026): общий для карточки договора (contract.html — главное место) и сделки (sales.html — новая сделка
   и сделки без договора). Товар из каталога (saleproducts), кол-во, цена, опции строки (канат / зацепы горки / доп. перемычки — схема opt с сервера,
   catalog/options.ts), «в комплекте с» (навесное к комплексу, sales/bundle.ts), обязательные опции (opt.required) — рамка красная, без них
   checkPos() не пускает сохранение. Сервер проверяет всё ещё раз (write.ts checkDealItems).
   Ждёт от страницы: el, esc, money, setm, get; контейнер <div class="pos" id="posBox">, <datalist id="prodlist">; стили .pos — в <style> страницы.
   Хук onPosTotal() (если объявлен) зовётся после пересчёта сумм. Валюта — TWI_CUR. */
var PRODS=[], PRODBYNAME={}, PRODBYSKU={}, POS=[], POS0='', POSCHK=false, TWI_CUR='руб';
var OPTNAME={ropeColor:'цвет каната', slideHooks:'зацепы горки'};
function loadProducts(){
  if(PRODS.length) return Promise.resolve(PRODS);
  return get({vapi:'saleproducts'}).then(function(r){
    PRODS=(r&&r.products)||[]; PRODBYNAME={}; PRODBYSKU={};
    var dl=el('prodlist'); if(dl) dl.innerHTML=PRODS.map(function(p){ return '<option value="'+esc(p.name)+'">'+(p.price?(money(p.price)+' руб'):'')+'</option>'; }).join('');
    PRODS.forEach(function(p){ PRODBYNAME[p.name]=p; PRODBYSKU[p.sku]=p; });
    if(POS.length) renderPos();   // схемы опций подъехали позже позиций
    return PRODS;
  }).catch(function(){ return PRODS; });
}
/** позиции ответа сервера (apiDeal / contractget items) → строки редактора; par — ссылка на объект строки-комплекса */
function posFromItems(items){
  var l=(items||[]).map(function(it){ var o=it.options||{}; return { id:it.id, name:(it.equip?it.equip+' ':'')+(it.model||it.name||''), qty:it.qty, price:it.price, sku:it.sku||it.art||'',
    options:o, opt:it.opt||null, complex:!!it.complex, crossbar:(it.extra&&o.extraCrossbars)?it.extra/o.extraCrossbars:0, pl:it.parentLine||0 }; });
  l.forEach(function(p){ p.par=p.pl?l[p.pl-1]||null:null; delete p.pl; });
  return l;
}
function pickProd(i,v){ var p=PRODBYNAME[v]; if(p){ POS[i].name=p.name; POS[i].sku=p.sku; POS[i].opt=p.opt||null; POS[i].crossbar=p.crossbar||0; POS[i].options={}; if(!(Number(POS[i].price)>0)) POS[i].price=p.price; renderPos(); posTot(); } }
function optOf(p){ return p.opt || ((PRODBYSKU[p.sku]||{}).opt) || null; }
function cbOf(p){ return Number(p.crossbar)||Number((PRODBYSKU[p.sku]||{}).crossbar)||0; }
function extraOf(p){ return (Number((p.options||{}).extraCrossbars)||0)*cbOf(p); }   // надбавка к цене единицы
function lineSum(p){ return (Number(p.qty)||0)*((Number(p.price)||0)+extraOf(p)); }
function optText(p){ var o=p.options||{}, t=[]; if(o.ropeColor) t.push('канат '+o.ropeColor); if(o.slideHooks) t.push('горка с '+(o.slideHooks==='реечки'?'реечками':'кружочками')); if(o.extraCrossbars) t.push('+ '+o.extraCrossbars+' компл. перемычек'); return t.join('; '); }
/* обязательные опции (opt.required с сервера): у «в комплекте с» канат комплекса — не проверяем */
function optMiss(p){ var s=optOf(p), o=p.options||{}; if(!s||p.par) return []; return (s.required||[]).filter(function(k){ return !o[k]; }).map(function(k){ return OPTNAME[k]||k; }); }
function posMissMsg(){ var l=POS.filter(keepPos); for(var j=0;j<l.length;j++){ var m=optMiss(l[j]); if(m.length) return 'Позиция '+(j+1)+' ('+String(l[j].name||'').trim()+'): выберите '+m.join(' и '); } return ''; }
/** true — можно сохранять; иначе подсветка + текст в m (id элемента сообщения) */
function checkPos(m){ var t=posMissMsg(); if(!t) return true; POSCHK=true; renderPos(); setm(m,'err','⚠️ '+t); var x=document.querySelector('#posBox select.req'); if(x) x.focus(); return false; }
function setOpt(i,k,v){ var o=POS[i].options||(POS[i].options={}); if(v===''||v==='0') delete o[k]; else o[k]=(k==='extraCrossbars')?Number(v):v; renderPos(); posTot(); }
/* «в комплекте с»: комплекс — строка со схемой зацепов горки (DSK/DSK-L) или complex с сервера */
function isCx(p){ var s=optOf(p); return !!(p.complex || (s && s.slideHooks)); }
function cxList(){ return POS.filter(function(p){ return isCx(p) && !p.par; }); }
function ropeOf(p){ return p.par ? ((p.par.options||{}).ropeColor||'') : ((p.options||{}).ropeColor||''); }
function setParent(i,v){ var p=POS[i]; p.par=(v==='')?null:POS[Number(v)]; if(p.par && p.options) delete p.options.ropeColor; renderPos(); posTot(); }
function bundleSum(p){ var t=lineSum(p); POS.forEach(function(k){ if(k.par===p) t+=lineSum(k); }); return t; }
function optHtml(p,i){ var s=optOf(p), cx=cxList(), kid=!!p.par, o=p.options||{};
  if(!s && (isCx(p) || !cx.length)) return '';
  var h='<div class="popt'+(kid?' kid':'')+'"><span>Опции:</span>';
  var req=(s&&s.required)||[];
  var sel=function(k,cur,opts,after){ var bad=req.indexOf(after)>=0 && !cur; return '<label>'+k+(req.indexOf(after)>=0?' *':'')+' <select'+(bad?' class="req" aria-invalid="true"':'')+' onchange="setOpt('+i+',\''+after+'\',this.value)">'+opts.map(function(x){ return '<option value="'+esc(x[0])+'"'+(String(cur||'')===String(x[0])?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select></label>'; };
  if(!isCx(p) && cx.length) h+='<label class="bnd">В комплекте с <select onchange="setParent('+i+',this.value)"><option value="">—</option>'
    +cx.map(function(c){ var k=POS.indexOf(c); return '<option value="'+k+'"'+(p.par===c?' selected':'')+'>'+esc(c.name||('строка '+(k+1)))+'</option>'; }).join('')+'</select></label>';
  if(!s) return h+'</div>';
  if(s.ropeColor && kid) h+='<span>канат как у комплекса: '+esc(ropeOf(p)||'не выбран')+'</span>';
  else if(s.ropeColor) h+=sel('канат',o.ropeColor,[['','—'],['синий','синий'],['красный','красный']],'ropeColor');
  if(s.slideHooks) h+=sel('горка',o.slideHooks,[['','—'],['реечки','с реечками'],['кружочки','с кружочками']],'slideHooks');
  var miss=optMiss(p); if(POSCHK && miss.length) h+='<span class="err">выберите '+esc(miss.join(' и '))+'</span>';
  if(s.extraCrossbars>0){ var os=[['','нет']]; for(var n=1;n<=s.extraCrossbars;n++) os.push([String(n),n+' компл.']); h+=sel('доп. перемычки',o.extraCrossbars,os,'extraCrossbars')+(cbOf(p)?'<span>'+money(cbOf(p))+' руб/компл.</span>':''); }
  return h+'</div>'; }
/** порядок показа: дети — под родителем */
function posOrder(list){ var order=[]; list.forEach(function(p){ if(!p.par || list.indexOf(p.par)<0){ order.push(p); list.forEach(function(k){ if(k.par===p) order.push(k); }); } }); return order; }
function renderPos(){
  var box=el('posBox'); if(!box) return;
  var h='<div class="pr ph"><div>Наименование</div><div>Кол-во</div><div>Цена</div><div style="text-align:right">Сумма</div><div></div></div>', tot=0;
  posOrder(POS).forEach(function(p){ var i=POS.indexOf(p), s=lineSum(p), kid=!!p.par, kids=POS.some(function(k){ return k.par===p; }); tot+=s;
    h+='<div class="pr'+(kid?' kid':'')+'">'
      +'<input list="prodlist" value="'+esc(p.name||'')+'" oninput="POS['+i+'].name=this.value" onchange="pickProd('+i+',this.value)" placeholder="'+(kid?'↳ ':'')+'товар из каталога или свой" title="'+(kid?'↳ в комплекте с комплексом':'')+'" autocomplete="off">'
      +'<input type="number" inputmode="decimal" value="'+esc(p.qty||'')+'" oninput="POS['+i+'].qty=this.value;posTot()" autocomplete="off">'
      +'<input type="number" inputmode="decimal" value="'+esc(p.price||'')+'" oninput="POS['+i+'].price=this.value;posTot()" autocomplete="off">'
      +'<div class="lt" id="lt'+i+'">'+money(s)+'</div>'
      +'<button class="ic rm" onclick="rmPos('+i+')" title="удалить позицию">✕</button></div>'
      +(kid?'<div class="bnote"><span class="kidmark">↳ в комплекте с «'+esc(p.par.name||'')+'»</span></div>':'')
      +(kids?'<div class="bnote">в документах: одной строкой с навесным (сумма '+money(bundleSum(p))+')</div>':'')+optHtml(p,i);
  });
  h+='<div class="tot">Итого: <span id="posTotal">'+money(tot)+'</span> '+esc(TWI_CUR)+'</div>';
  box.innerHTML=h;
  var hint=el('posHint'); if(hint) hint.textContent=POS.length?'':'добавьте товары или услуги';
}
/** только просмотр (карточка сделки «Что продано»): таблица с опциями и «↳ в комплекте с» */
function posViewHtml(items, cur){
  var list=posFromItems(items); if(!list.length) return '<div class="sm">Позиций нет.</div>';
  var tot=0, h='<div class="tbl-wrap"><table class="tbl pv mob"><thead><tr><th class="n">№</th><th>Наименование</th><th class="n">Кол-во</th><th class="n">Цена</th><th class="n">Сумма</th></tr></thead><tbody>', k=0;
  posOrder(list).forEach(function(p){ var s=lineSum(p), ot=optText(p), kid=!!p.par; tot+=s; k++;
    h+='<tr><td class="n" data-l="№">'+k+'</td><td data-l="Наименование">'+(kid?'<span class="kidmark">↳</span> ':'')+esc(p.name||'')+(p.sku?' <span class="sm">'+esc(p.sku)+'</span>':'')
      +(ot?'<div class="ot">'+esc(ot)+'</div>':'')+(kid?'<div class="ot">в комплекте с «'+esc(p.par.name||'')+'»</div>':'')+'</td>'
      +'<td class="n" data-l="Кол-во">'+esc(p.qty)+'</td><td class="n" data-l="Цена">'+money((Number(p.price)||0)+extraOf(p))+'</td><td class="n" data-l="Сумма">'+money(s)+'</td></tr>'; });
  return h+'<tr><td colspan="4" class="n"><b>Итого:</b></td><td class="n"><b>'+money(tot)+'</b> '+esc(cur||TWI_CUR)+'</td></tr></tbody></table></div>';
}
function posTotalValue(){ var tot=0; POS.forEach(function(p){ tot+=lineSum(p); }); return Math.round(tot*100)/100; }
function posTot(){ POS.forEach(function(p,i){ var e=el('lt'+i); if(e) e.textContent=money(lineSum(p)); }); var t=el('posTotal'); if(t) t.textContent=money(posTotalValue()); if(typeof onPosTotal==='function') onPosTotal(); }
function addPos(){ POS.push({name:'',qty:1,price:''}); renderPos(); }
// удалили комплекс — его навесное становится самостоятельным и оставляет канат комплекса
function rmPos(i){ var g=POS[i]; POS.forEach(function(k){ if(k.par===g){ var r=(g.options||{}).ropeColor; k.par=null; k.options=k.options||{}; if(r) k.options.ropeColor=r; } }); POS.splice(i,1); renderPos(); posTot(); }
function keepPos(p){ return String(p.name||'').trim() || (Number(p.qty)||0)>0; }
// на сервер: parentLine — номер строки комплекса в этом же списке (с 1); id — ID строки сделки (совпавшая строка сохраняет места/массу)
function cleanPos(){ var list=POS.filter(keepPos); return list.map(function(p){ var o={}; for(var k in p) if(k!=='par') o[k]=p[k]; o.parentLine=p.par?list.indexOf(p.par)+1:0; return o; }); }
function posKey(list){ var l=list.filter(keepPos); return JSON.stringify(l.map(function(p){ return [String(p.name||'').trim(), Number(p.qty)||0, Number(p.price)||0, optText(p), p.par?l.indexOf(p.par)+1:0]; })); }
