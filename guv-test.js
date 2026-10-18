// Guvenlik + saglik testleri: node guv-test.js [http://127.0.0.1:3000]
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('PASS  ' + ad); }
  else { fail++; console.log('FAIL  ' + ad + '  ' + detay); }
};
(async () => {
  // 1) API saglikli mi
  let r = await fetch(BASE + '/api/spot');
  ok('GET /api/spot 200', r.status === 200, r.status);
  const j = await r.json().catch(() => null);
  ok('API JSON + 9 satir', !!(j && Array.isArray(j.rows) && j.rows.length === 9), j && j.rows && j.rows.length);
  // 2) Guvenlik basliklari
  const h = (n) => r.headers.get(n);
  ok('nosniff', h('x-content-type-options') === 'nosniff');
  ok('X-Frame-Options DENY', h('x-frame-options') === 'DENY');
  ok('CSP var', (h('content-security-policy') || '').includes('default-src'));
  ok('no-store', (h('cache-control') || '').includes('no-store'));
  // 3) Metot kisiti
  for (const m of ['POST', 'PUT', 'DELETE']) {
    const rr = await fetch(BASE + '/api/spot', { method: m });
    ok(m + ' -> 405', rr.status === 405, rr.status);
  }
  // 4) Dizin disina cikma
  const t = await fetch(BASE + '/..%2F..%2Fwindows%2Fwin.ini');
  ok('traversal engelli', t.status === 404, t.status);
  const t2 = await fetch(BASE + '/server.js');
  ok('server.js inecek mi? (iner, kaynak zaten acik)', t2.status === 200, t2.status);
  // 5) MIME tipleri
  const m1 = await fetch(BASE + '/manifest.json');
  ok('manifest MIME', (m1.headers.get('content-type') || '').includes('application/json'));
  const m2 = await fetch(BASE + '/icons/icon-192.png');
  ok('png MIME', (m2.headers.get('content-type') || '').includes('image/png'));
  // 6) Hiz siniri: 70 hizli istekte 429 gorulmeli
  let kod = {};
  for (let i = 0; i < 70; i++) {
    try { const rr = await fetch(BASE + '/api/spot'); kod[rr.status] = (kod[rr.status] || 0) + 1; }
    catch { kod.err = (kod.err || 0) + 1; }
  }
  ok('rate-limit 429 uretiyor', (kod[429] || 0) > 0, JSON.stringify(kod));
  console.log(`\nSONUC: ${pass} gecti, ${fail} kaldi`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST HATASI:', e.message); process.exit(2); });
