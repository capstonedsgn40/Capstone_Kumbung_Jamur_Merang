# Sistem Monitoring & Otomatisasi Pengkabutan Kumbung Jamur Berbasis IoT

Aplikasi web _real-time_ untuk memantau kondisi suhu dan kelembapan udara pada **6 titik rak kumbung jamur** sekaligus mengendalikan pompa pengkabutan (_mist nozzle_) secara otomatis maupun manual berdasarkan fase pertumbuhan jamur.

---

## Fitur Utama Aplikasi (Panduan Penggunaan)

1. **Pemantauan Kondisi Real-Time (6 Titik Sensor)**
   - Menampilkan rata-rata suhu (`°C`) dan kelembapan relatif (`%`) di dalam kumbung secara langsung (pembaruan setiap 3 detik).
   - Memantau pembacaan masing-masing dari 6 sensor DHT22 secara terpisah beserta status kesehatannya (`ONLINE` atau `ERROR`).
2. **Otomatisasi Berdasarkan Fase Pertumbuhan**
   - Mendukung dua profil pengaturan kelembapan yang dapat diganti langsung dari dashboard:
     - **Fase Vegetatif (Pertumbuhan Miselium):** Default batas kelembapan **80% – 88%**.
     - **Fase Generatif (Pembentukan Tubuh Buah):** Default batas kelembapan **90% – 93%**.
   - Batas bawah dan batas atas kelembapan pada tiap fase dapat disesuaikan secara fleksibel melalui form pengaturan di dashboard.
3. **Kontrol Pompa Mode Otomatis & Manual**
   - **Mode AUTO:** Sistem menyalakan pompa secara otomatis ketika kelembapan rata-rata turun di bawah batas bawah fase aktif, dan mematikannya ketika mencapai batas atas.
   - **Mode MANUAL:** Pengguna dapat menyalakan atau mematikan pompa pengkabutan kapan saja secara jarak jauh melalui tombol saklar di dashboard.
4. **Indikator Koneksi Alat & Keamanan Fail-Safe**
   - Mendeteksi otomatis apabila perangkat di kumbung kehilangan koneksi internet/listrik (`OFFLINE`).
   - Dilengkapi pengaman otomatis (_fail-safe_) di dalam perangkat keras: jika seluruh sensor gagal membaca data, pompa otomatis dimatikan untuk mencegah banjir/kelembapan berlebih.
5. **Grafik Riwayat Data**
   - Menyimpan catatan perubahan suhu dan kelembapan secara berkala untuk dianalisis melalui grafik tren (filter rentang waktu 1 jam, 6 jam, 24 jam, hingga 7 hari).

---

## Arsitektur & Cara Kerja Sistem

Sistem ini menghubungkan perangkat keras di lapangan dengan dashboard web melalui jalur komunikasi aman tanpa mengekspos kredensial perangkat ke publik:

```text
[6x Sensor DHT22] ──▶ [ESP32 + Relay Pompa + LCD]
                            │  ▲
         Telemetry (3 dtk)  │  │  Perintah Kontrol & Fase
                            ▼  │
                   [EMQX Cloud Broker]
                            │
                            ▼ (HTTP Webhook)
                   [Next.js Backend API]
                            │
                            ▼
                [Supabase Database & Auth]
                            │
                            ▼ (Supabase Realtime)
                 [Dashboard Web Pengguna]
```

- **Perangkat Lapangan (`firmware/`):** Mikrokontroler ESP32 membaca 6 sensor DHT22, menampilkan status ringkas pada layar LCD 16x2 di box panel, serta menjalankan logika otomatisasi pompa secara mandiri (tetap berjalan normal meskipun koneksi internet terputus sementara).
- **Dashboard Web (`app/`):** Dibangun menggunakan Next.js (TypeScript) dan Tailwind CSS, dilindungi sistem login Supabase Auth, serta terhubung ke Supabase PostgreSQL untuk pembaruan layar instan tanpa perlu me-refresh halaman.

---

## Pemetaan Perangkat Keras (Hardware Wiring)

| Komponen              | Pin ESP32               | Fungsi                                                         |
| --------------------- | ----------------------- | -------------------------------------------------------------- |
| Sensor DHT22 #1 – #3  | GPIO 4, 16, 17          | Pembacaan suhu & kelembapan Rak Kiri (Atas, Tengah, Bawah)     |
| Sensor DHT22 #4 – #6  | GPIO 18, 19, 23         | Pembacaan suhu & kelembapan Rak Kanan (Atas, Tengah, Bawah)    |
| Layar LCD 16x2 (I2C)  | GPIO 21 (SDA), 22 (SCL) | Indikator lokal suhu, kelembapan, status pompa, mode, dan fase |
| Modul Relay 1-Channel | GPIO 26                 | Saklar otomatis/manual untuk Pompa Pengkabutan                 |

---

## Struktur Proyek

```text
├── firmware/               # Kode program C++ untuk mikrokontroler ESP32 (.ino)
├── app/                    # Halaman dashboard web, halaman login, dan API routes Next.js
├── lib/                    # Konfigurasi koneksi Supabase dan validasi data
├── public/                 # Aset statis aplikasi web
├── supabase.sql            # Skema tabel database dan aturan keamanan (RLS)
└── .env.example            # Template variabel lingkungan (environment variables)
```

---

## Panduan Instalasi & Menjalankan Proyek

### 1. Persiapan Database (Supabase)

1. Buat proyek baru di Supabase.
2. Buka menu **SQL Editor**, salin seluruh isi file `supabase.sql`, lalu klik **Run**.
3. Buat akun pengguna (admin) melalui menu **Authentication** $\rightarrow$ **Users** $\rightarrow$ **Add User**.

### 2. Konfigurasi Environment Variables

Salin file `.env.example` menjadi `.env.local` dan lengkapi nilainya:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

MQTT_BROKER_URL=mqtts://w7dca772.ala.asia-southeast1.emqxsl.com:8883
MQTT_USERNAME=your_emqx_username
MQTT_PASSWORD=your_emqx_password
MQTT_TOPIC_PREFIX=kumbung_jamur_capstone_9921

WEBHOOK_SECRET=your_custom_webhook_secret
```

### 3. Menjalankan Aplikasi Web

```bash
# Instal dependensi
npm install

# Jalankan server pengembangan lokal
npm run dev
```

Buka `http://localhost:3000` di browser dan masuk menggunakan akun yang telah dibuat di Supabase.

### 4. Konfigurasi Perangkat Keras (ESP32)

1. Buka file di dalam folder `firmware/` menggunakan Arduino IDE atau Arduino Cloud Web Editor.
2. Sesuaikan `WIFI_SSID` dan `WIFI_PASS` dengan jaringan Wi-Fi 2.4 GHz di lokasi kumbung.
3. Unggah (upload) program ke papan ESP32.
