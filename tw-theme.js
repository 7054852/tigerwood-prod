/* ТИГЕРВУД — тема «день / ночь» для всех экранов сервиса.
   Подключать в <head> ПЕРВЫМ скриптом, до стилей экрана: <script src="tw-theme.js"></script>
   - сам подключает шрифт Onest и tw-theme.css (если его ещё нет на странице);
   - ставит <html data-theme="day|night"> до отрисовки — без вспышки светлой темы;
   - режим: ?theme= → window.__TWTHEME__ (GAS-панели) → localStorage.twTheme → «auto»;
   - «auto» = по восходу и закату в Минске, пересчёт раз в 5 минут;
   - слушает {tw:'theme', mode} от оболочки;
   - window.twTheme: get() / set(mode) / sun(date) / now() / icon(name).
   ⚠ ES5: страницы открываются в Telegram на старых Android. */
(function(root){
  var LAT=53.9, LNG=27.5667;   // Минск

  // ── восход/закат (алгоритм SunCalc, точность ±1–2 мин) ──
  var rad=Math.PI/180, dayMs=86400000, J1970=2440588, J2000=2451545, J0=0.0009, E=rad*23.4397;
  function toDays(d){ return d.valueOf()/dayMs - 0.5 + J1970 - J2000; }
  function fromJ(j){ return new Date((j + 0.5 - J1970)*dayMs); }
  function sun(date, lat, lng){
    lat=lat==null?LAT:lat; lng=lng==null?LNG:lng;
    var lw=rad*-lng, phi=rad*lat, d=toDays(date||new Date());
    var n=Math.round(d - J0 - lw/(2*Math.PI));
    var ds=J0 + lw/(2*Math.PI) + n;
    var M=rad*(357.5291 + 0.98560028*ds);
    var L=M + rad*(1.9148*Math.sin(M) + 0.02*Math.sin(2*M) + 0.0003*Math.sin(3*M)) + rad*102.9372 + Math.PI;
    var dec=Math.asin(Math.sin(E)*Math.sin(L));
    var Jnoon=J2000 + ds + 0.0053*Math.sin(M) - 0.0069*Math.sin(2*L);
    var w=Math.acos((Math.sin(-0.833*rad) - Math.sin(phi)*Math.sin(dec))/(Math.cos(phi)*Math.cos(dec)));
    var a=J0 + (w + lw)/(2*Math.PI) + n;
    var Jset=J2000 + a + 0.0053*Math.sin(M) - 0.0069*Math.sin(2*L);
    return { rise:fromJ(Jnoon - (Jset - Jnoon)), set:fromJ(Jset) };
  }
  function autoTheme(now){ now=now||new Date(); var s=sun(now); return (now>=s.rise && now<s.set)?'day':'night'; }
  // «до 19:12» / «с 06:41» — подпись для переключателя, по минскому времени
  function hm(d){
    try{ return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Minsk'}); }
    catch(e){ var h=d.getHours(), m=d.getMinutes(); return (h<10?'0':'')+h+':'+(m<10?'0':'')+m; }
  }
  function nowText(){
    var now=new Date(), s=sun(now), t=autoTheme(now);
    if(t==='day') return 'сейчас день, ночь с '+hm(s.set);
    var next=now<s.rise ? s.rise : sun(new Date(now.valueOf()+dayMs)).rise;
    return 'сейчас ночь, день с '+hm(next);
  }

  // ── иконки меню: линейные, один штрих ──
  var P={
    deals:'<path d="M3 7h18v12H3z"/><path d="M8 7V5h8v2"/><path d="M3 12h18"/>',
    clients:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18 14.6c1.6.6 2.7 2.4 3 5.4"/>',
    invoices:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    contracts:'<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/>',
    docs:'<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/>',
    price:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    products:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    catalog:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    ops:'<path d="M4 6h10M4 12h16M4 18h8"/><circle cx="17" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
    cost:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/>',
    boss:'<path d="M3 7h16a2 2 0 0 1 2 2v9H3z"/><path d="M3 7l12-3v3"/><circle cx="16.5" cy="13" r="1.2"/>',
    plan:'<path d="M3 21V10l5 3V10l5 3V10l8 4v7z"/><path d="M7 21v-3M12 21v-3M17 21v-3"/>',
    prodplan:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h4M7 17h7"/>',
    wipstore:'<path d="M3 9l9-5 9 5v11H3z"/><path d="M8 20v-6h8v6M8 17h8"/>',
    transfer:'<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    contractors:'<path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M17 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M2 20c0-3 2.5-5 5-5s5 2 5 5M14 20c0-2.2 1.6-4 3.5-4S21 17.8 21 20"/>',
    vyrab:'<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3 15l3 3 8-8"/>',
    vcheck:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
    otk:'<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    tabel:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    stats:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    myteam:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18 14.6c1.6.6 2.7 2.4 3 5.4"/>',
    indocs:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    materials:'<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4"/>',
    snab:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    hr:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.5-1.8 1.8-2.7 3.5-2.7s3 .9 3.5 2.7M15 10h3M15 13h3"/>',
    dash:'<path d="M3 13a9 9 0 0 1 18 0"/><path d="M12 13l4-4"/><path d="M5 19h14"/>',
    company:'<path d="M4 21V5l8-2v18M12 21V9l8 3v9M3 21h18"/><path d="M7 8h2M7 12h2M7 16h2M15 14h2M15 17h2"/>',
    access:'<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>',
    users:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.4-5.8 7-5.8s6.2 2 7 5.8"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    dot:'<circle cx="12" cy="12" r="2.5"/>'
  };
  function icon(name, cls){ return '<svg class="twi'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[name]||P.dot)+'</svg>'; }

  // проверка расчёта солнца без браузера: node tw-theme.js
  function demo(){
    function near(d, hh, mm, label){   // ожидание — минское время (UTC+3)
      var got=(d.getUTCHours()+3)*60 + d.getUTCMinutes(), want=hh*60+mm;
      if(Math.abs(got-want)>12) throw new Error(label+': '+Math.floor(got/60)+':'+(got%60)+' вместо '+hh+':'+mm);
    }
    var jun=sun(new Date(Date.UTC(2026,5,21,9))), dec=sun(new Date(Date.UTC(2026,11,21,9))), sep=sun(new Date(Date.UTC(2026,8,13,9)));
    near(jun.rise,4,39,'восход 21.06'); near(jun.set,21,46,'закат 21.06');
    // Минск на 17° западнее центра пояса UTC+3: солнечный полдень около 13:08, зимой светает поздно
    near(dec.rise,9,28,'восход 21.12'); near(dec.set,16,49,'закат 21.12');
    near(sep.set,19,33,'закат 13.09');
    if(autoTheme(new Date(Date.UTC(2026,8,13,9)))!=='day') throw new Error('полдень 13.09 должен быть днём');
    if(autoTheme(new Date(Date.UTC(2026,8,13,20)))!=='night') throw new Error('23:00 13.09 должна быть ночью');
    console.log('tw-theme: солнце посчитано верно');
  }
  if(typeof document==='undefined'){ demo(); return; }

  var d=document, de=d.documentElement, MODE='auto', TMR=0;
  function qp(n){ var m=new RegExp('[?&]'+n+'=([^&]+)').exec(location.search); return m?decodeURIComponent(m[1]):''; }
  function norm(m){ return (m==='day'||m==='night')?m:'auto'; }

  // шрифт и стили — один раз на страницу
  (function(){
    var ss=d.getElementsByTagName('script'), src='';
    for(var i=ss.length-1;i>=0;i--){ if(/tw-theme\.js/.test(ss[i].src||'')){ src=ss[i].src; break; } }
    var base=src.replace(/[^\/?#]*(\?.*)?$/,''), v=qp('v')||'', has=false, ls=d.getElementsByTagName('link');
    for(var j=0;j<ls.length;j++){ if(/tw-theme\.css/.test(ls[j].href||'')) has=true; }
    var html='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
      +'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap">';
    if(!has) html+='<link rel="stylesheet" href="'+base+'tw-theme.css'+(v?('?v='+encodeURIComponent(v)+(qp('r')?'-'+qp('r'):'')):'')+'">';
    try{ d.write(html); }catch(e){}
  })();
  if(/[?&]embed=1/.test(location.search)) de.className+=(de.className?' ':'')+'emb';

  function read(){
    // GAS-панель: адрес внутри песочницы пуст, режим кладёт сервер в __TWTHEME__ — он главнее хранилища
    var m=qp('theme')||root.__TWTHEME__||'';
    if(!m){ try{ m=localStorage.getItem('twTheme')||''; }catch(e){} }
    return norm(m);
  }
  function current(){ return MODE==='auto'?autoTheme():MODE; }
  function paintTelegram(){
    try{
      var tg=root.Telegram&&root.Telegram.WebApp; if(!tg||!tg.setHeaderColor) return;
      var c=current()==='night'?'#0F1115':'#F6F7F9';
      tg.setHeaderColor(c); if(tg.setBackgroundColor) tg.setBackgroundColor(c);
    }catch(e){}
  }
  function apply(){
    var t=current();
    if(de.getAttribute('data-theme')!==t){ de.setAttribute('data-theme',t); try{ root.dispatchEvent(new CustomEvent('twtheme',{detail:{theme:t,mode:MODE}})); }catch(e){} }
    paintTelegram();
    if(TMR) clearInterval(TMR); TMR=0;
    if(MODE==='auto') TMR=setInterval(apply, 300000);
  }
  function broadcast(){
    var fr=d.getElementsByTagName('iframe');
    for(var i=0;i<fr.length;i++){ try{ fr[i].contentWindow.postMessage({tw:'theme',mode:MODE},'*'); }catch(e){} }
  }
  function set(m, persist){
    MODE=norm(m);
    if(persist!==false){ try{ localStorage.setItem('twTheme',MODE); }catch(e){} }
    apply(); broadcast();
  }
  MODE=read(); apply();
  root.addEventListener('message',function(e){ var x=e&&e.data; if(x&&x.tw==='theme') set(x.mode, false); });
  // вернулись во вкладку после долгого перерыва — сразу сверить с солнцем
  d.addEventListener('visibilitychange',function(){ if(!d.hidden && MODE==='auto') apply(); });
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded', paintTelegram); else paintTelegram();

  root.twTheme={ get:function(){ return MODE; }, set:set, now:current, sun:sun, text:nowText, icon:icon };
})(typeof window!=='undefined'?window:this);
