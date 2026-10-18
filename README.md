# Kapalı Çarşı — Nadir + Hakan + Harem (3 Kaynak Ortalaması)

İstediğiniz tablo: en başta **ORTALAMA alış/satış**, yanda 3 kaynağın **SPOT alış/satışı**.

## Gösterilenler
- Altın ONS (USD), Gümüş ONS (USD), Platin ONS (USD)
- Gram Altın (TL), Gram Gümüş (TL)
- USD/TL, EUR/TL, GBP/TL (Pound)
- XAU/XAG (Altın/Gümüş rasyosu)
- Sütunlar: **ORT Alış/Satış (en başta)** | Nadir Alış/Satış | Hakan Alış/Satış | Harem Alış/Satış
- Her satırda `n/3` rozeti kaç kaynaktan ortalama alındığını gösterir.

## Satır butonları + TradingView grafik
- Her ürün adı **3 boyutlu buton**dur.
- Butona tıkladığınızda **hemen o satırın altında TradingView grafiği** açılır (tek seferde bir grafik, tekrar tıklayınca kapanır).
- Grafik üstünde zaman dilimi butonları: **Haftalık • Aylık • Yıllık • 5 Yıllık • Max**.
- Semboller: ONS'lar OANDA (XAU/XAG/XPT), gram altın/gümüş TL (`XAUTRYG`/`XAGTRYG`), USD/EUR `FX:USDTRY/EURTRY`, GBP `PEPPERSTONE:GBPTRY` (yoğun akışlı), XAU/XAG rasyosu (`OANDA:XAUUSD/XAGUSD`).

## Çalıştırma (lokal)
1. `npm install`
2. `npm start`
3. Tarayıcıda: `http://localhost:3000`

## Sunucu (bulut) ile çalıştırma
`index.html`, `app.js`, `server.js`, `package.json` dosyalarını bir GitHub reposuna yükleyip Render / Fly.io / Railway gibi ücretsiz Node.js barındırma hizmetine bağlayabilirsiniz.
- Render için `render.yaml` mevcut.
- Fly.io için `Dockerfile.fly` mevcut (eğer Docker imajı kullanmak isterseniz).

## Otomatik güncelleme
Sunucu ~45 sn'de bir Hakan+Harem+Nadir verisini tazeler. Sayfa 60 sn'de bir otomatik yeniler (sayaç üstte, kapatılabilir). "Şimdi Yenile" butonu ve sayfa refresh (F5) de tazeler.

## Güvenlik
- `npm audit`: sıfır zafiyet
- `/api/spot` sadece GET'e izin verir
- Hız sınırı (rate limiting): IP başına dakikada en fazla 60 istek
- CORS yok, yalnızca kendi kaynağından istekler kabul edilir
- Dizin çıkarma (path traversal) engellendi
- Güvenlik başlıkları: `nosniff`, `DENY`, `CSP`

Yatırım tavsiyesi değildir.
