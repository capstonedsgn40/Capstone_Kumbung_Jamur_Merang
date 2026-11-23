# System Requirements & Architecture Specification
**Project:** Sistem Monitoring & Otomatisasi Pengkabutan Kumbung Jamur Berbasis IoT  
**Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Supabase (PostgreSQL, Auth, Realtime), EMQX Cloud Serverless, Vercel  
**Firmware Reference:** `firmware/esp32-kumbung/esp32-kumbung.ino`

---

## 1. Gambaran Umum & Batasan Proyek
Aplikasi web untuk memantau suhu dan kelembapan udara pada **6 titik rak kumbung jamur** secara *real-time* serta mengendalikan pompa pengkabutan (*mist nozzle*) dalam dua fase budidaya (**Vegetatif** dan **Generatif**).

**Aturan Utama Pengembangan (Strict Rules):**
1. **Single-Device Scope:** Sistem dirancang khusus untuk **1 unit ESP32 (1 kumbung)**. Jangan membuat tabel `devices` terpisah atau relasi multi-tenant yang kompleks.
2. **Firmware Freeze:** Kontrak topik dan payload JSON mengikuti kode firmware aktual (`esp32-kumbung.ino`) tanpa mengubah firmware.
3. **Zero Credential Exposure:** Browser dilarang terhubung langsung ke broker MQTT EMQX. Seluruh alur komunikasi melewati server Next.js dan Supabase.
4. **Firmware Owns Automation:** Logika hysteresis dan fail-safe pompa berjalan di ESP32. Backend Next.js hanya menyimpan data dan meneruskan perintah kontrol/konfigurasi.

---

## 2. Arsitektur Komunikasi
* **Alur Telemetry (Baca Data):**
  `ESP32` $\xrightarrow{\text{MQTTS}}$ `EMQX Cloud` $\xrightarrow{\text{HTTP Server Webhook}}$ `POST /api/mqtt/webhook` $\rightarrow$ `Supabase DB` $\xrightarrow{\text{Realtime}}$ `Dashboard`
* **Alur Kontrol & Konfigurasi (Kirim Perintah):**
  `Dashboard` $\rightarrow$ `POST /api/mqtt/command` $\xrightarrow{\text{MQTTS}}$ `EMQX Cloud` $\rightarrow$ `ESP32` $\xrightarrow{\text{Konfirmasi Telemetry}}$ `Dashboard`

---

## 3. Kontrak Integrasi MQTT

### A. Konfigurasi Broker (Server-Side Only)
* **Broker URL:** `mqtts://w7dca772.ala.asia-southeast1.emqxsl.com:8883`
* **Topic Prefix:** `kumbung_jamur_capstone_9921`

### B. Topik & Struktur Payload JSON

#### 1. Telemetry (`kumbung_jamur_capstone_9921/telemetry`)
Dikirim ESP32 setiap 3 detik (atau instan setelah menerima perintah):
```json
{
  "status": "ONLINE",
  "avgTemp": 25.4,
  "avgRH": 81.2,
  "activeCount": 6,
  "pompa": true,
  "modeAuto": true,
  "fase": "GENERATIF",
  "activeBawahRH": 85.0,
  "activeAtasRH": 92.0,
  "config": {
    "vegetatif": { "bawah": 70.0, "atas": 80.0 },
    "generatif": { "bawah": 85.0, "atas": 92.0 }
  },
  "sensors": [
    { "id": 1, "pin": 4, "ok": true, "t": 25.2, "h": 82.0 },
    { "id": 2, "pin": 16, "ok": true, "t": 25.5, "h": 81.0 }
  ]
}
```

**Catatan Edge Case Firmware:** Saat seluruh sensor gagal (`activeCount == 0`), ESP32 mengirim payload minimal: `{"sensors": [...], "status": "CRITICAL_SENSOR_ERROR", "pompa": false}` tanpa field `avgTemp`, `avgRH`, dll. Backend wajib menangani nilai yang hilang dengan fallback `null` atau mempertahankan nilai konfigurasi terakhir.

#### 2. Kontrol Pompa & Mode (`kumbung_jamur_capstone_9921/control`)
Dikirim backend ke ESP32:
```json
{
  "modeAuto": false,
  "pompa": true
}
```

#### 3. Konfigurasi Fase & Threshold RH (`kumbung_jamur_capstone_9921/config`)
Dikirim backend ke ESP32:
```json
{
  "fase": "GENERATIF",
  "vegetatif": { "bawah": 70.0, "atas": 80.0 },
  "generatif": { "bawah": 85.0, "atas": 92.0 }
}
```

---

## 4. Desain Database Supabase (2 Tabel)
Jalankan skema SQL berikut di Supabase:
```sql
-- 1. Tabel status terkini (1 baris tetap dengan id = 1)
CREATE TABLE device_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  device_status TEXT NOT NULL DEFAULT 'OFFLINE',
  avg_temp NUMERIC,
  avg_rh NUMERIC,
  active_count INTEGER DEFAULT 0,
  pump_status BOOLEAN DEFAULT false,
  mode_auto BOOLEAN DEFAULT true,
  phase TEXT DEFAULT 'VEGETATIF',
  active_lower_rh NUMERIC DEFAULT 70.0,
  active_upper_rh NUMERIC DEFAULT 80.0,
  config JSONB DEFAULT '{"vegetatif": {"bawah": 70, "atas": 80}, "generatif": {"bawah": 85, "atas": 92}}'::jsonb,
  sensors JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO device_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Tabel riwayat pembacaan (Throttled setiap 15 detik)
CREATE TABLE telemetry_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  avg_temp NUMERIC,
  avg_rh NUMERIC,
  pump_status BOOLEAN,
  phase TEXT,
  sensors JSONB
);

CREATE INDEX idx_telemetry_logs_created_at ON telemetry_logs (created_at DESC);

-- Aktifkan Realtime & RLS
ALTER PUBLICATION supabase_realtime ADD TABLE device_status;
ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read device_status" ON device_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read telemetry_logs" ON telemetry_logs
  FOR SELECT TO authenticated USING (true);
```

---

## 5. Spesifikasi Backend API (`src/app/api/`)

### A. `POST /api/mqtt/webhook`
* **Autentikasi:** Wajib memeriksa header `x-webhook-secret` terhadap `process.env.WEBHOOK_SECRET`. Tolak dengan `401` jika tidak cocok.
* **Proses Data:**
  1. Validasi payload JSON masuk.
  2. Gunakan `SUPABASE_SERVICE_ROLE_KEY` untuk melakukan update pada `device_status` (`id = 1`) beserta `updated_at = new Date().toISOString()`.
  3. **Throttling Histori (15 Detik):** Query 1 record terbaru dari `telemetry_logs`. Jika belum ada data atau `now - lastRecord.created_at >= 15000 ms` dan `status !== "CRITICAL_SENSOR_ERROR"`, lakukan insert ke `telemetry_logs`.

### B. `POST /api/mqtt/command`
* **Autentikasi:** Wajib memverifikasi session Supabase Auth (`supabase.auth.getUser()`). Tolak dengan `401` jika belum login.
* **Payload Request:**
  * Tipe kontrol: `{ type: "CONTROL", modeAuto: boolean, pompa?: boolean }` $\rightarrow$ publish ke `${MQTT_TOPIC_PREFIX}/control`.
  * Tipe konfigurasi: `{ type: "CONFIG", fase?: "VEGETATIF" | "GENERATIF", vegetatif?: { bawah: number, atas: number }, generatif?: { bawah: number, atas: number } }` $\rightarrow$ validasi `bawah < atas` dan rentang 0–100, lalu publish ke `${MQTT_TOPIC_PREFIX}/config`.
* **Implementasi MQTT Serverless:** Buka koneksi `mqtt.connect()` sementara dengan kredensial server, publish pesan dengan QoS 1, lalu panggil `client.end()` sebelum mengembalikan respons JSON `200 OK`.

### C. `GET /api/telemetry/history`
* **Autentikasi:** Wajib memverifikasi session Supabase Auth.
* **Query Param:** `?range=1h|6h|24h|7d` (default `1h`).
* **Proses:** Ambil data dari `telemetry_logs` sesuai rentang waktu berurutan naik (`ASC`) untuk dirender pada grafik.

---

## 6. Spesifikasi Halaman & UI/UX Dashboard

### A. Autentikasi (`/login`)
* Halaman login menggunakan Supabase Auth (Email & Password). Tidak perlu halaman registrasi publik.
* Middleware Next.js melindungi rute `/dashboard` agar mengarahkan pengguna tanpa session ke `/login`.

### B. Single-Page Dashboard (`/dashboard`)
* **Tema Desain:** Soft Pink Modern (dominasi latar putih bersih `#FFFFFF` / `#FAFAFA`, kartu membulat dengan border halus, aksen soft/dusty pink untuk tombol utama dan elemen aktif).
* **Warna Status Semantik (Wajib Standar):** Hijau untuk `ONLINE` / Sensor OK / Pompa ON, Merah untuk `CRITICAL_SENSOR_ERROR` / Sensor Error, Abu-abu untuk `OFFLINE` / Pompa OFF.
* **Komponen Utama (Dalam 1 Halaman Terstruktur):**
  1. **Top Bar & Connection Badge:** Judul sistem, indikator koneksi alat (`ONLINE` jika `now - updated_at <= 15 detik`, selain itu otomatis berubah menjadi `OFFLINE` via interval timer di client), waktu pembaruan terakhir, dan tombol Logout.
  2. **Kartu Ringkasan (4 KPI Cards):** Rata-rata Suhu (°C), Rata-rata Kelembapan (%), Status Pompa Aktual (ON/OFF), dan Sensor Aktif (X / 6).
  3. **Panel Kontrol & Fase:**
     * Toggle pemilihan fase aktif: Vegetatif vs Generatif.
     * Toggle mode operasi: Otomatis (AUTO) vs Manual (MANUAL).
     * **Saklar Pompa Manual (ON/OFF):** Hanya aktif jika `modeAuto === false` dan alat ONLINE. Menampilkan status "Menunggu konfirmasi perangkat..." saat diklik hingga update Realtime dari ESP32 masuk.
  4. **Panel Pengaturan Batas Kelembapan (RH):** Form input terpisah untuk Fase Vegetatif (Batas Bawah %, Batas Atas %) dan Fase Generatif (Batas Bawah %, Batas Atas %) beserta tombol Simpan.
  5. **Grid 6 Kartu Sensor DHT22:** Menampilkan Titik 1–6 (Suhu, Kelembapan, Pin GPIO, lencana status). Jika `ok: false` atau nilai `null`, tampilkan `--` dengan indikator merah.
  6. **Grafik Riwayat (Historical Chart):** Grafik garis responsif untuk tren Suhu dan Kelembapan dengan tombol filter rentang waktu (1 Jam, 6 Jam, 24 Jam, 7 Hari).

---

## 7. Environment Variables (`.env.example`)
```env
# Supabase (Public & Server)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# EMQX Cloud Serverless (Server-Only)
MQTT_BROKER_URL=mqtts://w7dca772.ala.asia-southeast1.emqxsl.com:8883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC_PREFIX=kumbung_jamur_capstone_9921

# EMQX Webhook Security
WEBHOOK_SECRET=
```