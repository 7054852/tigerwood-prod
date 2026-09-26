// Адрес сервера для ВСЕХ страниц — меняется только здесь (переезд на Прохаб). ES5: грузится и в экранах рабочих.
// ?srv=staging — эта страница (и следующие в этом браузере) ходит через Прохаб-staging; ?srv=gas — вернуть как было.
// Только адреса из списка: чужой адрес по ссылке подсунуть нельзя (иначе токен ушёл бы на чужой сервер).
(function () {
  var SRV = {
    gas: 'https://script.google.com/macros/s/AKfycbxbCSBcKbG-az-3-_JPJpMLtlQHenJJftHwXM_N-7PvBMfHWVD6xqxDD36nrmtBIz8W/exec',
    staging: 'https://prohub-staging.tigerwood.by/exec',
    prod: 'https://prohub.tigerwood.by/exec'
  };
  var DEF = 'prod';   // ← переключение всех страниц на Прохаб: 'prod' (откат — обратно 'gas'); ?srv=prod — проверить одну страницу заранее
  var pick = DEF;
  try {
    var m = /[?&]srv=([a-z]+)/.exec(location.search);
    if (m && SRV[m[1]]) { if (m[1] === DEF) localStorage.removeItem('tw_srv'); else localStorage.setItem('tw_srv', m[1]); }
    var s = localStorage.getItem('tw_srv'); if (s && SRV[s]) pick = s;
  } catch (e) {}
  window.TW_CFG = { srv: pick, hub: SRV[pick] };
})();
