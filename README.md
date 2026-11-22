# Mushroom IoT Mist Control

Dashboard Next.js untuk pemantauan DHT22 dan pengendalian mist nozzle ESP32 melalui Arduino Cloud.

## Setup

1. Salin `.env.example` menjadi `.env.local`.
2. Isi credential Arduino Cloud, Thing ID, PIN, dan secret sesi.
3. Jalankan `npm install`, lalu `npm run dev`.
4. Buat Thing Arduino Cloud dengan lima property: `suhu`, `kelembapan`, `pompaStatus`, `modeAuto`, dan `batasBawahRH`.
5. Tempel firmware dari `firmware/kumbung_jamur_cloud.ino` ke Arduino Cloud Sketch dan isi SSID, password, device ID, serta device secret.

## Perintah

- `npm run dev` — menjalankan dashboard lokal.
- `npm run lint` — memeriksa kualitas TypeScript/React.
- `npm run build` — membangun aplikasi untuk produksi.

## Keamanan

Credential Arduino Cloud hanya dibaca oleh route handler server. Dashboard dilindungi cookie sesi HTTP-only dan PIN. Perubahan property dibatasi oleh skema Zod pada endpoint `/api/iot`.
