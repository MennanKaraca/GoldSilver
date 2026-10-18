
const state = { auto:true, timer:60 };
const fmt = (v,d=2)=> (v==null||!isFinite(v)) ? '<span style="color:#5b6b82">—</span>' : v.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
const cell = (p,dec,ref)=> p==null||!isFinite(p) ? '<td class="na">—</td>' : `<td class="src">${fmt(p,dec)}${ref?'<sup style="color:var(--gold)" title="Bu kaynak platin yayınlamıyor; küresel spot referans (Harem) gösterilmiştir">*</sup>':''}</td>`;
const cellR = (o,dec)=> cell(o.s,dec,o.r);
const cellA = (o,dec)=>{ const v=o.a; return v==null||!isFinite(v) ? '<td class="na">—</td>' : `<td class="src">${fmt(v,dec)}${o.r?'<sup style="color:var(--gold)" title="Bu kaynak platin yayınlamıyor; küresel spot referans (Harem) gösterilmiştir">*</sup>':''}</td>`;};

async function load(){
  const btn=document.getElementById('refreshBtn'), dot=document.getElementById('statusDot'),
        st=document.getElementById('statusText'), err=document.getElementById('errBox');
  btn.disabled=true; err.style.display='none';
  let j=null, hata='';
  // Emniyet: 45 sn'de veri gelmezse yine de bilgi goster (asla sessizce takilma)
  const watchdog = setTimeout(()=>{
    if(!j){
      err.style.display='block';
      err.innerHTML='<b>Hâlâ bağlanıyor…</b> Ağın yavaş olabilir. Biraz bekle, olmazsa <b>Şimdi Yenile</b>ye bas veya sekmeyi kapatıp linki yeniden aç.';
    }
  }, 45000);
  // Yavas/kopuk baglantilarda takilmayi onlemek icin: zaman asimli, 3 denemeli cekme
  for(let den=1; den<=3; den++){
    try{
      dot.className='dot wait';
      st.textContent = den===1 ? 'Güncelleniyor…' : `Tekrar deneniyor (${den}/3)…`;
      const ctrl = new AbortController();
      const to = setTimeout(()=>ctrl.abort(), 12000);
      const r = await fetch('api/spot',{cache:'no-store',signal:ctrl.signal});
      clearTimeout(to);
      if(!r.ok) throw new Error('HTTP '+r.status);
      j = await r.json();
      break;
    }catch(e){ hata = (e.name==='AbortError' ? 'zaman aşımı' : String(e.message||e)); }
  }
  if(!j){
    clearTimeout(watchdog);
    err.style.display='block';
    err.innerHTML='<b>Veriler alınamadı ('+hata+').</b> Bağlantın yavaşsa biraz bekleyip <b>Şimdi Yenile</b>ye bas veya sayfayı yenile (Ctrl+F5).';
    dot.className='dot off'; st.textContent='Bağlantı yok';
    btn.disabled=false; state.timer=60;
    return;
  }
  try{
    render(j);
    clearTimeout(watchdog);
    document.getElementById('lastUpdate').textContent = new Date(j.updatedAt).toLocaleString('tr-TR');
    const n=[j.sources.nadir.ok,j.sources.hakan.ok,j.sources.harem.ok].filter(Boolean).length;
    dot.className='dot'+(n===3?'':n===0?' off':' wait');
    st.textContent = `${n}/3 kaynak aktif`;
  }catch(e){
    err.style.display='block';
    err.innerHTML='<b>Sunucuya ulaşılamadı.</b> Sayfayı <b>node server.js</b> ile çalıştırıp <b>http://localhost:3000</b> adresinden açın. (Dosyaya çift tıklayarak açıldığında canlı veriler gelmez.) Hata: '+String(e.message||e);
    dot.className='dot off'; st.textContent='Bağlantı yok';
  }
  btn.disabled=false; state.timer=60;
}

function render(j){
  lastPayload = j;
  lastRows = j.rows || [];
  const tb=document.getElementById('tbody');
  tb.innerHTML = j.rows.map(r=>{
    const badge = `<span class="cnt">${r.kaynakSayisi}/3</span>`;
    const open = openSym===r.k;
    let html = `<tr>
      <td class="urun"><button class="rowbtn${open?' open':''}" style="--ac:${ACCENT[r.k]||'#38bdf8'}" data-sym="${r.k}"><span>${r.label}</span><span class="ch">▾</span></button><span class="birim">${r.unit} ${badge}</span></td>
      <td class="avg"><b>${fmt(r.ort.a,r.dec)}</b></td>
      <td class="avg"><b>${fmt(r.ort.s,r.dec)}</b></td>
      ${cellA(r.nadir,r.dec)}${cellR(r.nadir,r.dec)}
      ${cellA(r.hakan,r.dec)}${cellR(r.hakan,r.dec)}
      ${cellA(r.harem,r.dec)}${cellR(r.harem,r.dec)}
    </tr>`;
    if(open) html += `<tr class="chartrow"><td colspan="9">${chartHtml(r)}</td></tr>`;
    return html;
  }).join('');
  tb.querySelectorAll('.rowbtn').forEach(b=>b.addEventListener('click',()=>toggleRow(b.dataset.sym)));
  bindTf();
  if(openSym) mountTV(openSym);
  const s=j.sources;
  const line=(n,o)=>`${n}: ${o.ok?'✅':'❌'} <small style="color:var(--muted)">${o.time||o.err||''}</small>`;
  document.getElementById('srcLegend').innerHTML = `${line('Nadir',s.nadir)} • ${line('Hakan',s.hakan)} • ${line('Harem',s.harem)}`;
  document.getElementById('footNote').textContent =
    `Nadir (${s.nadir.ok?'canlı':'hata'}${s.nadir.time?', '+s.nadir.time:''}) • Hakan (${s.hakan.ok?'canlı':'hata'}) • Harem (${s.harem.ok?'canlı':'hata'})`;
  const g=k=>j.rows.find(r=>r.k===k);
  const card=(t,v,s)=>`<div class="stat"><h2>${t}</h2><div class="v">${v}</div><div class="s">${s}</div></div>`;
  document.getElementById('statGrid').innerHTML =
    card('Altın ONS — ORT satış', fmt(g('XAUUSD').ort.s)+' <small>$</small>', `Nadir — • Hakan ${fmt(g('XAUUSD').hakan.s)} • Harem ${fmt(g('XAUUSD').harem.s)}`) +
    card('Gram Altın — ORT satış', fmt(g('GRAM_ALTIN').ort.s)+' <small>₺</small>', `Hakan ${fmt(g('GRAM_ALTIN').hakan.s)} • Harem ${fmt(g('GRAM_ALTIN').harem.s)}`) +
    card('USD/TL — ORT satış', fmt(g('USDTRY').ort.s,4), `Nadir ${fmt(g('USDTRY').nadir.s,4)} • Hakan ${fmt(g('USDTRY').hakan.s,4)} • Harem ${fmt(g('USDTRY').harem.s,4)}`) +
    card('XAU/XAG — ORT', fmt(g('XAUXAG').ort.s), `Altın ÷ Gümüş rasyosu (${g('XAUXAG').kaynakSayisi}/3 kaynak)`);
}

// ---- 3D sembol butonlari + TradingView grafik ----
const TV_SYMBOLS = {XAUUSD:'OANDA:XAUUSD',XAGUSD:'OANDA:XAGUSD',XPTUSD:'OANDA:XPTUSD',GRAM_ALTIN:'XAUTRYG',GRAM_GUMUS:'XAGTRYG',USDTRY:'FX:USDTRY',EURTRY:'FX:EURTRY',GBPTRY:'PEPPERSTONE:GBPTRY',XAUXAG:'OANDA:XAUUSD/XAGUSD'};
const TV_TFS = [
  {id:'H',label:'Haftalık',interval:'60',range:'5D'},
  {id:'A',label:'Aylık',interval:'D',range:'1M'},
  {id:'Y',label:'Yıllık',interval:'W',range:'12M'},
  {id:'B',label:'5 Yıllık',interval:'W',range:'60M'},
  {id:'M',label:'Max',interval:'M',range:'ALL'},
];
const ACCENT = {XAUUSD:'#e8b64c',XAGUSD:'#c0c8d4',XPTUSD:'#e5e4e2',GRAM_ALTIN:'#e8b64c',GRAM_GUMUS:'#c0c8d4',USDTRY:'#34d399',EURTRY:'#38bdf8',GBPTRY:'#a78bfa',XAUXAG:'#f472b6'};
let lastRows = [], openSym = null, openTF = 'A';

function toggleRow(sym){
  openSym = (openSym===sym) ? null : sym;
  const tb = document.getElementById('tbody');
  // tabloyu yeniden cizmeden sadece satirlari guncelle: en temizi render'i tekrar cagirmak icin son veriyi sakla
  if(lastPayload) render(lastPayload);
}
let lastPayload = null;
function chartHtml(r){
  const tfBtns = TV_TFS.map(t=>`<button class="tf-btn${t.id===openTF?' on':''}" data-tf="${t.id}" data-sym="${r.k}">${t.label}</button>`).join('');
  return `<div class="chart-box">
    <div class="tf-row">${tfBtns}</div>
    <div class="tv-box" id="tv-${r.k}"></div>
    <div class="tv-src">Grafik verisi: <a href="https://tr.tradingview.com/symbols/${encodeURIComponent(TV_SYMBOLS[r.k])}/" target="_blank" rel="noopener">TradingView • ${TV_SYMBOLS[r.k]}</a></div>
  </div>`;
}
function mountTV(sym){
  const r = lastRows.find(x=>x.k===sym); if(!r) return;
  const tf = TV_TFS.find(t=>t.id===openTF) || TV_TFS[1];
  const box = document.getElementById('tv-'+sym); if(!box) return;
  const isRatio = TV_SYMBOLS[sym].indexOf('/') > -1;
  // rasyo sembolunde range parametresi tarih eksenini bozuyor: varsayilan gorunum + interval kullan
  const cfg = {autosize:true,symbol:TV_SYMBOLS[sym],interval:tf.interval};
  if(!isRatio){ cfg.range = tf.range; }
  Object.assign(cfg,{withdateranges:true,theme:'dark',style:'1',locale:'tr',backgroundColor:'rgba(11,15,26,1)',gridColor:'rgba(44,56,82,0.5)',hide_side_toolbar:false,hide_volume:true,allow_symbol_change:false,save_image:false,calendar:false,support_host:'https://www.tradingview.com'});
  box.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%">
    <div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>`;
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  s.async = true;
  s.innerHTML = JSON.stringify(cfg);
  box.querySelector('.tradingview-widget-container').appendChild(s);
}
function bindTf(){
  document.querySelectorAll('.tf-btn').forEach(b=>b.addEventListener('click',(e)=>{
    e.stopPropagation(); openTF=b.dataset.tf;
    document.querySelectorAll(`.tf-btn[data-sym="${b.dataset.sym}"]`).forEach(x=>x.classList.toggle('on',x===b));
    mountTV(b.dataset.sym);
  }));
}

document.getElementById('refreshBtn').addEventListener('click', load);
document.getElementById('autoBtn').addEventListener('click', e=>{
  state.auto=!state.auto;
  e.target.textContent='Otomatik: '+(state.auto?'Açık':'Kapalı');
});
setInterval(()=>{
  if(!state.auto) return;
  state.timer--;
  if(state.timer<=0){ load(); return; }
  document.getElementById('countdown').textContent=state.timer;
},1000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && state.auto) load(); });
load();
// PWA: service worker (yalnizca guvenli baglamda: https veya localhost)
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}
