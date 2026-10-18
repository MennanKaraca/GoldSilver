# Yayın Kılavuzu (Web — 3 Kaynak SPOT Ortalaması)

İstediğiniz tablo: en başta **ORTALAMA alış/satış**, yanda 3 kaynağın SPOT alış/satışı.

## Çalıştırma (lokal)
1. `npm install` (ilk seferde bir kez)
2. `npm start`
3. Tarayıcıda: `http://localhost:3000`

## Ücretsiz web yayını (Render.com önerisi)

Render, Node.js uygulamalarını ücretsiz barındırır.

1. Bu klasörü GitHub'a yükleyin.
2. [render.com](https://render.com) hesabı açın.
3. **New → Blueprint** seçin ve GitHub reposunuzu bağlayın.
4. `render.yaml` dosyası zaten mevcut, otomatik yapılandırılacak.
5. Yayın bittikten sonra size `https://<proje-adi>.onrender.com` gibi bir adres verilir.

### Adresi telefona uygulama gibi yüklemek (PWA)
Sayfa zaten PWA uygunudur (`manifest.json`, `sw.js`, `icons/` klasörü).
- Android Chrome: menü → "Ana ekrana ekle"
- iOS Safari: paylaş → "Ana Ekrana Ekle"

## IP / alan adı değişirse
Sunucu adresi kendi domain'iniz ise her şey otomatik çalışır. Eğer Render gibi ücretsiz bir hizmet kullanıyorsanız, Render size verilen URL kullanılır.

## APK / mobil uygulama gerekmez
Bu proje şu an **sadece web tabanlıdır**. Tarayıcıdan açılıp telefonunuza "Ana ekrana ekle" diyerek uygulama gibi kullanılabilir. APK dosyası oluşturulmamıştır.

## Güvenlik
- Tüm istekler HTTPS üzerinden Render tarafından sunulur (Render otomatik SSL verir).
- `npm audit` sıfır zafiyet gösterir.
- Sunucu tarafında: hız sınırı, GET-only API, dizin çıkarma koruması, güvenlik başlıkları (CSP, X-Frame-Options, X-Content-Type-Options).

Yatırım tavsiyesi değildir.
