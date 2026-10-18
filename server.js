// Kapali Carsi 3-kaynak spot sunucusu: Nadir + Hakan + Harem
// Calistir: npm install && npm start  ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const PORT = process.env.PORT || 3000;
const OZ = 31.1034768;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KapaliCarsi-Tablo/1.0';

// ---- metric tanimlari ----
const METRICS = [
  { k: 'XAUUSD', label: 'Altın ONS', unit: 'USD / ons', dec: 2 },
  { k: 'XAGUSD', label: 'Gümüş ONS', unit: 'USD / ons', dec: 2 },
  { k: 'XPTUSD', label: 'Platin ONS', unit: 'USD / ons', dec: 2 },
  { k: 'GRAM_ALTIN', label: 'Gram Altın', unit: 'TL / gram', dec: 2 },
  { k: 'GRAM_GUMUS', label: 'Gram Gümüş', unit: 'TL / gram', dec: 2 },
  { k: 'USDTRY', label: 'USD/TL', unit: 'Dolar', dec: 4 },
  { k: 'EURTRY', label: 'EUR/TL', unit: 'Euro', dec: 4 },
  { k: 'GBPTRY', label: 'GBP/TL', unit: 'Sterlin (Pound)', dec: 4 },
  { k: 'XAUXAG', label: 'XAU/XAG', unit: 'Altın ÷ Gümüş', dec: 2 },
];

const num = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(',', '.');
  const f = parseFloat(s);
  return Number.isFinite(f) ? f : null;
};
const avg = (arr) => {
  const a = arr.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
};

// ---- cache ----
const blankMap = () => ({
  XAUUSD: { a: null, s: null }, XAGUSD: { a: null, s: null }, XPTUSD: { a: null, s: null },
  GRAM_ALTIN: { a: null, s: null }, GRAM_GUMUS: { a: null, s: null },
  USDTRY: { a: null, s: null }, EURTRY: { a: null, s: null }, GBPTRY: { a: null, s: null },
});
const cache = {
  hakan: { ok: false, time: null, m: blankMap() },
  harem: { ok: false, time: null, m: blankMap() },
  nadir: { ok: false, time: null, m: blankMap() },
  serverTime: null,
};

// ---- HAKAN: REST ----
async function fetchHakan() {
  try {
    const r = await fetch('https://api.hakanaltin.net/api/history/latest', {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const byId = {};
    for (const d of j.data || []) byId[d.symbol_id] = d;
    const g = (id) => byId[id] || {};
    const px = (id) => ({ a: num(g(id).last_bid_price), s: num(g(id).last_ask_price) });
    cache.hakan = {
      ok: true, time: j.lastUpdated || new Date().toISOString(),
      m: {
        XAUUSD: px('XAUUSD'),       // ONS Istanbul
        XAGUSD: px('XAGONS'),       // gumus ons
        XPTUSD: { a: null, s: null }, // Hakan'da platin yok
        GRAM_ALTIN: px('1GR.995TRY'),
        GRAM_GUMUS: px('GUMTRY'),
        GRAM_PLATIN: { a: null, s: null },
        USDTRY: px('USDTRY'), EURTRY: px('EURTRY'), GBPTRY: px('GBPTRY'),
      },
    };
  } catch (e) {
    cache.hakan.ok = false;
    cache.hakan.err = String(e.message || e).slice(0, 150);
  }
}

// ---- HAREM: socket.io (surekli baglanti) ----
function connectHarem() {
  const s = io('wss://hrmsocketonly.haremaltin.com', {
    transports: ['websocket'], timeout: 15000, reconnection: true,
  });
  s.on('connect', () => console.log('[harem] baglandi', s.id));
  s.on('disconnect', () => { console.log('[harem] baglanti koptu'); cache.harem.ok = false; });
  s.on('connect_error', (e) => console.log('[harem] baglanti hatasi:', e.message));
  s.on('price_changed', (rec) => {
    try {
      // Harem parca parca guncelleme gonderebilir: mevcut degerlerle BIRLESTIR (uzerine yazma)
      const d = rec.data || {};
      const cur = cache.harem.m;
      const setPx = (target, code) => {
        const v = d[code];
        if (!v) return;
        const a = num(v.alis), s = num(v.satis);
        if (a !== null) cur[target].a = a;
        if (s !== null) cur[target].s = s;
      };
      setPx('XAUUSD', 'ONS');
      setPx('XAGUSD', 'XAGUSD');
      setPx('XPTUSD', 'XPTUSD');
      setPx('GRAM_ALTIN', 'KULCEALTIN');
      setPx('GRAM_GUMUS', 'GUMUSTRY');
      setPx('USDTRY', 'USDTRY');
      setPx('EURTRY', 'EURTRY');
      setPx('GBPTRY', 'GBPTRY');
      cache.harem.ok = true;
      cache.harem.time = new Date().toISOString();
    } catch (e) { console.log('[harem] parse hatasi', e.message); }
  });
}

// ---- NADIR: doviz aynadan (isaretli, Nadir kaynakli) + metaller headless tarayicidan ----
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
function stripHtml(h) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');
}
function setNadirFx(usd, eur, gbp, time) {
  // sadece doviz hucrelerini gunceller; metaller korunur
  cache.nadir.m.USDTRY = usd; cache.nadir.m.EURTRY = eur; cache.nadir.m.GBPTRY = gbp;
  cache.nadir.ok = true; cache.nadir.time = time; cache.nadir.err = null;
}
async function fetchNadir() {
  // Birincil: anlikaltinfiyatlari Nadir sayfasi (Nadir'den canli cekiyor, zaman damgali)
  try {
    const r = await fetch('https://anlikaltinfiyatlari.com/doviz/nadir-doviz', {
      headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = stripHtml(await r.text());
    const row = (name) => {
      const m = t.match(new RegExp(name + '\\s+(\\d{2}:\\d{2}:\\d{2})\\s+([\\d.]+)\\s+([\\d.]+)'));
      return m ? { time: m[1], a: num(m[2]), s: num(m[3]) } : null;
    };
    const usd = row('Dolar'), eur = row('Euro'), gbp = row('Sterlin');
    if (!usd || !eur || !gbp) throw new Error('tablo parse edilemedi');
    setNadirFx({ a: usd.a, s: usd.s }, { a: eur.a, s: eur.s }, { a: gbp.a, s: gbp.s }, usd.time);
    return;
  } catch (e) { console.log('[nadir] birincil ayna hatasi:', e.message); }
  // Yedek: dovizgrafik Nadir sayfasi
  try {
    const r = await fetch('https://dovizgrafik.com/nadir-doviz.html', {
      headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = stripHtml(await r.text());
    const cell = (label, code) => {
      const m = t.match(new RegExp(label + '\\s*\\(' + code + '\\)\\s*([\\d.]+)\\s+([\\d.]+)'));
      return m ? { a: num(m[1]), s: num(m[2]) } : null;
    };
    const usd = cell('Dolar', 'USD'), eur = cell('Euro', 'EUR'), gbp = cell('Sterlin', 'GBP');
    if (!usd) throw new Error('yedek tablo parse edilemedi');
    setNadirFx(usd, eur || { a: null, s: null }, gbp || { a: null, s: null }, new Date().toISOString());
  } catch (e) {
    cache.nadir.ok = cache.nadir.ok && !!cache.nadir.time; // eski deger varsa koru
    cache.nadir.err = String(e.message || e).slice(0, 150);
  }
}

// Nadir metalleri (headless): once etiketli ana sayfa, eksikler icin fiyatekrani eslesmesi
let nadirHeadlessBusy = false;
async function fetchNadirMetals() {
  if (nadirHeadlessBusy) return;
  nadirHeadlessBusy = true;
  try {
    const { fetchNadirMetals: runCompact, fetchNadirMain } = require('./nadir-headless.js');
    const got = [];
    try {
      const main = await fetchNadirMain();
      for (const k of Object.keys(main || {})) {
        if (main[k]?.s && cache.nadir.m[k]) { cache.nadir.m[k] = { a: main[k].a, s: main[k].s }; got.push(k + ':ana'); }
      }
    } catch (e) { console.log('[nadir] ana sayfa hatasi:', String(e.message || e).slice(0, 150)); }
    // eksik kalanlar icin fiyatekrani buyukluk eslesmesi (Hakan+Harem referansli)
    const missing = ['XAUUSD', 'XAGUSD', 'GRAM_ALTIN', 'GRAM_GUMUS'].filter((k) => cache.nadir.m[k]?.s == null);
    if (missing.length) {
      const refOf = (srcA, srcB) => ({ s: avg([srcA?.s, srcB?.s]) });
      const ref = {
        XAUUSD: refOf(cache.hakan.m.XAUUSD, cache.harem.m.XAUUSD),
        XAGUSD: refOf(cache.hakan.m.XAGUSD, cache.harem.m.XAGUSD),
        GRAM_ALTIN: refOf(cache.hakan.m.GRAM_ALTIN, cache.harem.m.GRAM_ALTIN),
        GRAM_GUMUS: refOf(cache.hakan.m.GRAM_GUMUS, cache.harem.m.GRAM_GUMUS),
      };
      const r = await runCompact(ref);
      for (const k of Object.keys(r.m || {})) {
        if (r.m[k]?.s && cache.nadir.m[k] && cache.nadir.m[k].s == null) {
          cache.nadir.m[k] = { a: r.m[k].a, s: r.m[k].s }; got.push(k + ':ekran');
        }
      }
    }
    if (got.length) {
      cache.nadir.ok = true;
      cache.nadir.metalsTime = new Date().toISOString();
      cache.nadir.metalsCount = got.length;
      console.log(`[nadir] metaller: ${got.join(',')}`);
    } else {
      console.log('[nadir] metal eslesmesi yok');
    }
  } catch (e) {
    console.log('[nadir] headless hatasi:', String(e.message || e).slice(0, 200));
  }
  nadirHeadlessBusy = false;
}

// ---- turetilmis degerler + ortalama ----
function enrich(m) {
  // XAU/XAG = ons_altin / ons_gumus
  if (m.XAUUSD?.s && m.XAGUSD?.s) m.XAUXAG = { a: null, s: m.XAUUSD.s / m.XAGUSD.s };
  if (m.XAUUSD?.a && m.XAGUSD?.a) m.XAUXAG.a = m.XAUUSD.a / m.XAGUSD.a;
  if (!m.XAUXAG) m.XAUXAG = { a: null, s: null };
  return m;
}

function buildPayload() {
  const N = enrich({ ...cache.nadir.m, XAUXAG: undefined });
  const K = enrich({ ...cache.hakan.m, XAUXAG: undefined });
  const H = enrich({ ...cache.harem.m, XAUXAG: undefined });
  // enrich icin kopya: her kaynagin kendi XAUXAG'i hesaplansin
  const rows = METRICS.map((def) => {
    const n = N[def.k] || {}, k = K[def.k] || {}, h = H[def.k] || {};
    // Platin: Hakan ve Nadir yayinlamiyor (kuresel tek fiyat) -> Harem referansi "*" isaretli gosterilir
    if (def.k === 'XPTUSD') {
      if ((k.s == null) && h.s != null) { k.a = h.a; k.s = h.s; k.r = true; }
      if ((n.s == null) && h.s != null) { n.a = h.a; n.s = h.s; n.r = true; }
    }
    const a = avg([n.a, k.a, h.a]);
    const s = avg([n.s, k.s, h.s]);
    const cnt = def.k === 'XPTUSD'
      ? (H[def.k]?.s != null ? 1 : 0) // referans hucreler sayilmaz
      : [n.s, k.s, h.s].filter((v) => v !== null && v !== undefined && Number.isFinite(v)).length;
    return {
      k: def.k, label: def.label, unit: def.unit, dec: def.dec,
      nadir: { a: n.a ?? null, s: n.s ?? null, r: !!n.r },
      hakan: { a: k.a ?? null, s: k.s ?? null, r: !!k.r },
      harem: { a: h.a ?? null, s: h.s ?? null },
      ort: { a, s }, kaynakSayisi: cnt,
    };
  });
  return {
    updatedAt: new Date().toISOString(),
    sources: {
      nadir: { ok: cache.nadir.ok, time: cache.nadir.time, metalsTime: cache.nadir.metalsTime || null, metalsCount: cache.nadir.metalsCount || 0, err: cache.nadir.err || null, note: 'Doviz: Nadir aynasi (canli). Metaller: Nadir sayfasi (headless, canli)' },
      hakan: { ok: cache.hakan.ok, time: cache.hakan.time, err: cache.hakan.err || null, note: 'api.hakanaltin.net (canli)' },
      harem: { ok: cache.harem.ok, time: cache.harem.time, err: cache.harem.err || null, note: 'Harem socket (canli)' },
    },
    rows,
  };
}

// ---- http sunucusu (guvenlik sertlestirmeli) ----
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
// CSP: TradingView widget icin gerekli izinler (script + cerceve + stiller). Diger hersey kapali.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://s3.tradingview.com https://www.tradingview.com",
  "frame-src https://www.tradingview.com https://www.tradingview-widget.com",
  "connect-src 'self' https://www.tradingview.com https://s3.tradingview.com",
  "worker-src 'self' https://www.tradingview.com https://s3.tradingview.com blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  'object-src \'none\'',
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CSP,
};
// Hiz sinirlama: IP basina kayan pencerede en fazla istek (kotuye kullanimi engeller)
const RATE = new Map(); // ip -> [zamanlar]
const RATE_MAX = 60, RATE_WIN = 60 * 1000;
function clientIp(req) {
  // Tünel/proxy arkasında gerçek istemci IP'si (Cloudflare öncelikli)
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).split(',')[0].trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of RATE) {
    const fresh = ts.filter((t) => now - t < RATE_WIN);
    if (fresh.length) RATE.set(ip, fresh); else RATE.delete(ip);
  }
}, 30 * 1000).unref();
const server = http.createServer((req, res) => {
  // 1) Yalnizca GET (API dahil). Diger metodlar reddedilir.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SEC_HEADERS, Allow: 'GET, HEAD' }); res.end('izin verilmiyor');
    return;
  }
  // 2) Hiz siniri
  const ip = clientIp(req);
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < RATE_WIN);
  hits.push(now); RATE.set(ip, hits);
  if (hits.length > RATE_MAX) {
    res.writeHead(429, { ...SEC_HEADERS, 'Retry-After': '60' }); res.end('cok fazla istek');
    return;
  }
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch { res.writeHead(400, SEC_HEADERS); res.end('hatali istek'); return; }
  if (url.pathname === '/api/spot') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SEC_HEADERS });
    res.end(JSON.stringify(buildPayload()));
    return;
  }
  let f = url.pathname === '/' ? '/index.html' : url.pathname;
  let fp;
  try {
    fp = path.normalize(path.join(ROOT, decodeURIComponent(f)));
  } catch { res.writeHead(400, SEC_HEADERS); res.end('hatali istek'); return; }
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404, SEC_HEADERS); res.end('bulunamadi');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', ...SEC_HEADERS });
  fs.createReadStream(fp).pipe(res);
});

let cycle = 0;
async function refreshAll() {
  cycle++;
  await Promise.allSettled([fetchHakan(), fetchNadir()]);
  // Nadir metalleri agir is (headless tarayici): ~4 dongude bir, bloklamadan
  if (cycle % 4 === 1) fetchNadirMetals();
  cache.serverTime = new Date().toISOString();
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} dolu. Baska bir kopya calisiyor olabilir; onu kapatip tekrar deneyin.`);
    process.exit(1);
  }
  throw e;
});
server.listen(PORT, async () => {
  console.log('Kapali Carsi 3-kaynak tablosu: http://localhost:' + PORT);
  connectHarem();
  await refreshAll();
  setInterval(refreshAll, 45000); // sunucu tarafi 45 sn'de bir tazeler
});

// Duzgun kapanis: headless tarayiciyi da kapat (arka planda surec birakma)
function shutdown() {
  try { require('./nadir-headless.js').closeBrowser().finally(() => process.exit(0)); }
  catch { process.exit(0); }
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
