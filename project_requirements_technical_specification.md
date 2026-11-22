# Technical Specification & Requirements: IoT Mushroom Mist Nozzle Automation

## 1. Project Overview & Architecture
Sistem otomatisasi pengabutan (*mist nozzle*) untuk budidaya jamur berbasis **ESP32** dan sensor **DHT22**, terintegrasi dengan **Arduino Cloud** sebagai *IoT broker/backend*, serta memiliki **Custom Web Dashboard** (Next.js App Router) yang di-hosting di **Vercel** untuk pemantauan jarak jauh dan kontrol manual (*override*).

### System Data Flow
```text
[DHT22 + Relay/Pump] <---> [ESP32 Firmware] <---> [Arduino Cloud IoT] <---> [Next.js Backend API (Vercel)] <---> [Web Dashboard UI]
```

### Core Objectives
1. **Autonomous Edge Operation:** ESP32 harus tetap menjalankan logika otomatisasi kelembapan secara lokal meskipun koneksi Wi-Fi atau internet terputus (*offline-first fail-safe*).
2. **Hardware & Crop Protection:** Mencegah banjir pada kumbung jamur akibat sensor *error* (`NaN`), *chattering* pada relay, atau kegagalan koneksi.
3. **Secure & Rate-Limit Safe Cloud Integration:** Menghubungkan web kustom ke Arduino Cloud API secara aman tanpa mengekspos kredensial OAuth2 dan menghindari pemblokiran API (`429 Too Many Requests`).

---

## 2. Arduino Cloud Configuration & Data Schema

### Thing Variables (Max 5 Variables - Arduino Cloud Free Plan Limit)
AI Agent harus mengasumsikan struktur variabel pada Arduino Cloud *Thing* sebagai berikut:

| Variable Name | C++ / Cloud Type | Permission | Update Policy | Description |
| :--- | :--- | :--- | :--- | :--- |
| `suhu` | `float` | Read Only | Periodically / On change | Pembacaan suhu aktual (°C) dari DHT22. |
| `kelembapan` | `float` | Read Only | Periodically / On change | Pembacaan kelembapan relatif aktual (% RH) dari DHT22. |
| `pompaStatus` | `bool` | Read & Write | On change | Status aktual pompa (`true` = ON, `false` = OFF). Dapat diubah dari web saat mode manual. |
| `modeAuto` | `bool` | Read & Write | On change | Mode operasi (`true` = Otomatis berdasarkan hysteresis sensor, `false` = Manual override dari web). |
| `batasBawahRH` | `float` | Read & Write | On change | Ambang batas bawah kelembapan (% RH) untuk menyalakan pompa otomatis (Default: `80.0`). |

*(Catatan: Batas atas hysteresis dihitung otomatis di firmware sebagai `batasBawahRH + 8.0`, atau dikonfigurasi sebagai konstanta offset agar tidak melebihi kuota 5 variabel Free Plan).*

---

## 3. Firmware Requirements (ESP32 + DHT22 + Relay)

### 3.1 Hardware Abstraction Layer (Pin Definitions)
Pisahkan seluruh konfigurasi pin dan tipe relay di bagian paling atas file `.ino` agar mudah disesuaikan dengan hardware fisik klien:
- `DHTPIN`: Default `15` (GPIO 15).
- `DHTTYPE`: `DHT22`.
- `PUMP_PIN`: Default `2` (GPIO 2).
- `RELAY_ACTIVE_LOW`: Boolean flag (`true` jika modul relay aktif saat sinyal `LOW`, `false` jika `HIGH`).

### 3.2 Preventive & Fail-Safe Mechanisms (MANDATORY)
1. **Non-Blocking Execution:** Dilarang keras menggunakan fungsi `delay()` di dalam `void loop()`. Seluruh penjadwalan pembacaan sensor wajib menggunakan `millis()` dengan interval minimal **2500 ms (2.5 detik)** sesuai batas *sampling rate* maksimal DHT22 (0.5 Hz).
2. **Sensor `NaN` & Saturation Handling:**
   - Validasi setiap pembacaan menggunakan `isnan(h) || isnan(t)` serta pengecekan rentang logis (`h < 0 || h > 100 || t < -10 || t > 60`).
   - Implementasikan penghitung kegagalan berturut-turut (`errorCount`). Jika sensor gagal terbaca **3 kali berturut-turut**, aktifkan kondisi **CRITICAL FAIL-SAFE**: paksa pompa mati (`OFF`) untuk mencegah kumbung jamur kebanjiran akibat sensor rusak/berkarat.
3. **Hysteresis & Anti-Chattering Control:**
   - Saat `modeAuto == true`, pompa menyala jika `kelembapan < batasBawahRH`, dan baru mati jika `kelembapan >= (batasBawahRH + 8.0)` (maksimal plafon `95.0%`).
   - Tambahkan *minimum state duration* (minimal jeda 5 detik sebelum status relay berubah lagi) untuk melindungi kumparan pompa dan kontak relay dari kerusakan mekanis (*chattering*).
4. **Hardware Watchdog Timer (WDT):**
   - Aktifkan `esp_task_wdt_init` (timeout 15–30 detik) untuk me-*restart* ESP32 secara otomatis jika terjadi *hang* akibat interferensi elektromagnetik (*back-EMF*) saat pompa menyala.
5. **Cloud Sync Callbacks:**
   - Implementasikan `onPompaStatusChange()` dan `onModeAutoChange()`. Jika user mengubah `pompaStatus` dari web, `modeAuto` harus otomatis diset ke `false` agar logika sensor lokal tidak menimpa perintah manual user.

---

## 4. Web Application Requirements (Next.js App Router + Vercel)

### 4.1 Tech Stack & Structure
- **Framework:** Next.js (App Router, TypeScript).
- **Styling:** Tailwind CSS (Responsive mobile-first design agar mudah dipantau petani/klien lewat smartphone di kumbung).
- **Deployment Target:** Vercel Serverless Functions.

### 4.2 Security Requirements (CRITICAL)
1. **Zero Client-Side Secret Exposure:** Kredensial Arduino Cloud (`ARDUINO_CLIENT_ID`, `ARDUINO_CLIENT_SECRET`, `ARDUINO_THING_ID`) hanya boleh diakses di server-side Route Handlers (`app/api/...`) melalui `process.env`.
2. **Dashboard Access Protection (PIN / Password Auth):**
   - Karena URL Vercel bersifat publik, buat middleware atau halaman login sederhana berbasis PIN/Password (`APP_ACCESS_PIN` di `.env`) yang menyimpan *HTTP-only, Secure, SameSite=Strict cookie* setelah verifikasi.
   - Seluruh endpoint `/api/iot/*` wajib memvalidasi keberadaan cookie sesi ini sebelum mengeksekusi permintaan, terutama endpoint `POST` yang mengontrol pompa.
3. **Input Validation & Sanitization:**
   - Validasi payload `POST` menggunakan schema validation (misal `zod` atau pengecekan tipe ketat) untuk memastikan hanya variabel dengan izin *Read & Write* (`pompaStatus`, `modeAuto`, `batasBawahRH`) yang boleh diubah, dengan batasan nilai `batasBawahRH` antara `60` hingga `90`.

### 4.3 Vercel & Arduino Cloud API Optimization
1. **Disable Static Caching:** Tambahkan `export const dynamic = 'force-dynamic';` dan `cache: 'no-store'` pada endpoint `GET /api/iot` agar Vercel tidak menyajikan data basi (*stale data*).
2. **OAuth2 Token Caching (Anti-Rate-Limit):**
   - Jangan meminta token baru ke `https://api2.arduino.cc/iot/v1/clients/token` pada setiap request frontend.
   - Simpan `access_token` dan `expires_at` pada variabel module-level cache di server (dengan buffer aman 5 menit sebelum kedaluwarsa 3600 detik). Hanya minta token baru jika cache kosong atau hampir kedaluwarsa.
3. **Safe Polling Interval:** Frontend melakukan *polling* ke `/api/iot` setiap **5000 ms (5 detik)** dan otomatis menjeda *polling* saat tab browser tidak aktif (`document.visibilityState === 'hidden'`) untuk menghemat kuota API.

### 4.4 Frontend UI & UX Features
1. **Real-Time Telemetry Cards:** Menampilkan Suhu (°C) dan Kelembapan (% RH) dengan kode warna status (Normal / Terlalu Kering / Terlalu Lembap).
2. **Device Health & Stale Data Detection:**
   - Periksa properti `value_updated_at` dari Arduino Cloud API. Jika selisih waktu dengan waktu saat ini lebih dari **3 menit**, tampilkan banner peringatan **"Perangkat Offline / Sinyal Kumbung Terputus"** dan nonaktifkan tombol kontrol agar user tidak bingung.
3. **Control Panel:**
   - Toggle switch untuk **Mode Otomatis (`modeAuto`)** vs **Mode Manual**.
   - Tombol aksi **Nyalakan / Matikan Mist Nozzle (`pompaStatus`)** dengan status *loading/optimistic UI* dan konfirmasi visual.
   - Input slider/stepper untuk mengatur **Target Kelembapan Minimal (`batasBawahRH`)**.
4. **Error Boundary & Toast Notifications:** Tampilkan pesan error yang jelas jika koneksi ke Arduino Cloud gagal atau token tidak valid.

---

## 5. Environment Variables Template (`.env.local` & Vercel)
```env
# Arduino Cloud OAuth2 Credentials
ARDUINO_CLIENT_ID=your_client_id_here
ARDUINO_CLIENT_SECRET=your_client_secret_here
ARDUINO_THING_ID=your_thing_id_here

# Web Dashboard Security
APP_ACCESS_PIN=123456
AUTH_SECRET=random_32_char_secret_string_for_cookie_signing
```

---

## 6. Agent Execution Instructions
Saat mengimplementasikan spesifikasi ini, ikuti urutan berikut:
1. Buat struktur project Next.js App Router dengan TypeScript dan Tailwind CSS.
2. Implementasikan `lib/arduino-cloud.ts` yang menangani OAuth2 *token caching*, pengambilan *properties* (`GET`), dan publikasi nilai (`PUT`).
3. Buat sistem autentikasi PIN sederhana (`middleware.ts` + `/api/auth`) untuk melindungi halaman utama dan API kontrol.
4. Bangun API routes (`/api/iot/route.ts`) dengan validasi input ketat dan `force-dynamic`.
5. Bangun antarmuka dashboard (`app/page.tsx`) yang responsif, memiliki deteksi status *offline* berbasis timestamp, serta kontrol tombol manual dan pengaturan *threshold*.
6. Sediakan file referensi firmware lengkap (`firmware/kumbung_jamur_cloud.ino`) yang siap ditempel ke dalam tab Sketch Arduino Cloud.