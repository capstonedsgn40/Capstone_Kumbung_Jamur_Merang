# PROMPT REDESAIN UI/UX — SISTEM MONITORING KUMBUNG JAMUR

## 1. Tujuan Utama

Lakukan peningkatan tampilan UI/UX pada project Sistem Monitoring & Otomatisasi Pengkabutan Kumbung Jamur Berbasis IoT.

Gunakan konsep desain **Soft Pink Modern** dengan mengacu pada mockup dashboard yang diberikan sebagai referensi visual.

Tujuan perubahan adalah membuat aplikasi terlihat lebih modern, profesional, konsisten, informatif, dan nyaman digunakan pada desktop maupun perangkat mobile.

**PENTING: PEKERJAAN INI HANYA BERFOKUS PADA PERUBAHAN UI/UX. JANGAN MENGUBAH SISTEM TEKNIS, LOGIKA APLIKASI, ARSITEKTUR, STRUKTUR PROJECT, ATAU IMPLEMENTASI BACKEND YANG SUDAH BERJALAN DENGAN BENAR.**

## 2. ATURAN WAJIB — BATASAN PERUBAHAN

Bagian ini merupakan batasan utama yang harus dipatuhi selama pengerjaan.

### 2.1. Hal yang DILARANG untuk diubah

Jangan mengubah, menghapus, mengganti, atau melakukan refactor terhadap:

- Arsitektur aplikasi dan struktur direktori project.
- Struktur database Supabase, tabel, kolom, relasi, maupun konfigurasi database.
- API routes, server actions, dan mekanisme komunikasi frontend-backend.
- Integrasi MQTT dengan EMQX Cloud.
- Nama, struktur, dan format MQTT topics.
- Mekanisme subscribe dan publish MQTT.
- Mekanisme penerimaan dan pemrosesan telemetry.
- Mekanisme Supabase Realtime.
- Logika pembacaan dan pemrosesan data sensor.
- Perhitungan rata-rata suhu dan kelembapan.
- Logika penentuan status perangkat.
- Logika otomatisasi dan kontrol pompa.
- Logika pemilihan fase pertumbuhan jamur.
- Logika pengaturan batas kelembapan.
- Mekanisme autentikasi dan otorisasi.
- Kontrak data, tipe data, interface, dan struktur payload.
- Firmware ESP32 maupun konfigurasi perangkat keras.
- Environment variables dan konfigurasi deployment.
- Library, dependency, maupun versi package yang sudah digunakan.

**Jangan melakukan perubahan teknis hanya karena menurutmu ada cara implementasi yang lebih baik. Project sudah berjalan dengan benar dan tidak membutuhkan perubahan pada bagian tersebut.**

### 2.2. Hal yang DIPERBOLEHKAN untuk diubah

Perubahan hanya diperbolehkan pada aspek presentasi dan interaksi visual, meliputi:

- Warna, background, gradient, border, dan shadow.
- Typography, ukuran teks, ketebalan font, dan spacing.
- Layout, alignment, padding, margin, dan ukuran komponen.
- Bentuk kartu, tombol, badge, input, dan navigasi.
- Tampilan grafik dan visualisasi data.
- Tampilan indikator sensor dan status perangkat.
- Animasi transisi dan micro-interactions.
- Responsivitas desktop, tablet, dan mobile.
- Komposisi dan hierarki informasi pada dashboard.
- Komponen UI yang memang diperlukan untuk merealisasikan desain baru.

Jika diperlukan, kamu boleh memodifikasi JSX/TSX, CSS, Tailwind classes, dan komponen presentasi. Namun, jangan mengubah bagian logika yang terdapat dalam file tersebut.

### 2.3. Prinsip implementasi

1. Periksa implementasi UI yang sudah ada sebelum melakukan perubahan.
2. Pertahankan seluruh fungsi dan event handler yang sudah berjalan.
3. Gunakan kembali data dan state yang sudah tersedia.
4. Jangan membuat data dummy untuk menggantikan data aktual.
5. Jangan membuat ulang mekanisme komunikasi atau pengambilan data.
6. Jika sebuah komponen UI sudah memiliki fungsi, pertahankan fungsi tersebut ketika desainnya diubah.
7. Jika perubahan visual membutuhkan penyesuaian pada komponen yang juga mengandung logika bisnis, ubah hanya bagian presentasinya.
8. Jangan menghapus fitur yang sudah tersedia hanya demi menyederhanakan tampilan.

**Jika suatu perubahan visual tidak dapat dilakukan tanpa mengubah logika teknis, jangan memaksakan perubahan tersebut. Pertahankan implementasi yang ada dan laporkan kendalanya.**

---

## 3. Design System — Soft Pink Modern

Gunakan satu identitas warna utama, yaitu pink. Hindari penggunaan banyak warna aksen yang saling bersaing.

### 3.1. Palet warna

| Elemen | Warna | Kode |
|---|---|---|
| Background utama | Warm White Pink | `#FFF9FB` |
| Brand utama | Soft Pink | `#EC5F96` |
| Brand tint | Light Pink | `#FFE4EE` |
| Teks utama | Dark Plum | `#3B2A33` |
| Teks sekunder | Muted Plum | `#8A7580` |
| Border | Soft Pink Border | `#F6D5E1` |
| Status sukses / online | Green | `#22A06B` |
| Status offline / inactive | Gray | `#9CA3AF` |
| Status critical / error | Red | `#E5484D` |

### 3.2. Aturan penggunaan warna

- Pink digunakan untuk identitas brand, tombol utama, elemen aktif, toggle aktif, dan grafik utama.
- Gunakan light pink sebagai background elemen yang sedang dipilih.
- Gunakan hijau hanya untuk status sukses, online, kondisi normal, dan pompa ON.
- Gunakan abu-abu untuk offline, disabled, dan kondisi tidak aktif.
- Gunakan merah hanya untuk kondisi critical atau error.
- Status merah wajib disertai ikon dan label teks agar tidak tertukar dengan warna pink.
- Jangan menggunakan warna biru untuk status pompa ON.
- Jangan menggunakan pink sebagai pengganti warna status critical.

Pink sebaiknya hanya menempati sekitar 10–15% permukaan visual utama. Gunakan warna netral sebagai dominasi background.

### 3.3. Background dan efek visual

- Gunakan background utama `#FFF9FB`.
- Tambahkan radial gradient pink yang sangat tipis pada sudut atas halaman.
- Gunakan border pink yang halus.
- Gunakan shadow dengan tint pink: `rgba(236, 95, 150, 0.12)`.
- Hindari shadow abu-abu yang terlalu gelap.
- Gunakan radius komponen yang konsisten.
- Hindari terlalu banyak dekorasi yang mengganggu pembacaan data.

### 3.4. Typography

Gunakan font yang memiliki karakter lembut dan modern.

Rekomendasi:
- Plus Jakarta Sans.
- Nunito.

Jika project sudah menggunakan konfigurasi `next/font`, pertahankan mekanisme tersebut dan sesuaikan font hanya jika memang diperlukan untuk tampilan.

Gunakan tabular numbers untuk angka suhu, kelembapan, dan nilai statistik agar angka tidak bergeser ketika data berubah.

---

## 4. Redesign Dashboard

Gunakan mockup yang diberikan sebagai referensi komposisi, bukan sebagai instruksi untuk mengubah sistem yang sudah ada.

### 4.1. Header dan navigasi

Buat header yang bersih dengan:

- Nama aplikasi.
- Deskripsi singkat sistem monitoring.
- Status koneksi perangkat.
- Informasi terakhir diperbarui.
- Tombol logout.

Navigasi utama harus mudah dikenali dan konsisten dengan identitas pink.

Gunakan background pink tint pada menu yang sedang aktif.

Pada mobile, navigasi harus disesuaikan agar tidak mengambil terlalu banyak ruang layar. Gunakan pendekatan navigasi yang sesuai dengan struktur aplikasi saat ini.

### 4.2. Kartu kondisi kumbung

Jadikan kondisi kumbung sebagai informasi utama dashboard.

Buat satu kartu utama yang menampilkan:

- Gauge kelembapan rata-rata.
- Nilai suhu rata-rata.
- Nilai kelembapan rata-rata.
- Status pompa.
- Status kondisi kumbung.

Gauge harus terlihat jelas dan menjadi fokus visual.

Jika tersedia data fase aktif dan batas kelembapan, tampilkan rentang optimal sesuai fase tersebut.

Contoh ilustrasi:
- RH saat ini: 87%.
- Batas bawah: 85%.
- Batas atas: 92%.
- Status: Dalam Rentang Optimal.

Angka tersebut hanya contoh visual. Gunakan nilai aktual dari sistem.

Tambahkan sparkline kecil pada kartu KPI suhu dan kelembapan jika data historis tersedia.

### 4.3. Kontrol dan fase pertumbuhan

Buat bagian kontrol yang memisahkan dua jenis interaksi:

**Pemilihan fase pertumbuhan**
- Vegetatif.
- Generatif.

**Mode operasi**
- AUTO.
- MANUAL.

Gunakan segmented control dengan visual pill yang jelas.

Elemen aktif menggunakan brand pink dan light pink.

Jika memungkinkan, gunakan animasi perpindahan indikator aktif yang halus.

PENTING:
- Jangan mengubah fungsi kontrol yang sudah ada.
- Jangan mengubah payload atau mekanisme pengiriman perintah.
- Jangan mengubah state management yang sudah digunakan.
- Jangan membuat kontrol baru yang tidak terhubung dengan fungsi aktual.

### 4.4. Visualisasi status pompa

Status pompa harus memiliki perbedaan visual yang tegas.

**Pompa ON**
- Gunakan indikator hijau.
- Tampilkan ikon pompa atau indikator visual yang sesuai.
- Tambahkan animasi kabut atau tetesan air yang lembut jika memungkinkan.

**Pompa OFF**
- Gunakan indikator abu-abu.
- Tampilkan label yang jelas.
- Jangan menggunakan warna biru sebagai identitas status OFF.

Animasi hanya berjalan ketika status pompa benar-benar ON.

Jangan membuat animasi yang memberikan kesan pompa bekerja ketika status aktualnya OFF.

### 4.5. Grid enam sensor DHT22

Jangan menampilkan enam sensor sebagai kartu generik yang tidak memiliki hubungan visual.

Kelompokkan sensor sesuai posisi rak fisik:

| Rak Kiri | Rak Kanan |
|---|---|
| Titik 1 — Atas | Titik 4 — Atas |
| Titik 2 — Tengah | Titik 5 — Tengah |
| Titik 3 — Bawah | Titik 6 — Bawah |

Gunakan layout dua kolom dan tiga baris pada desktop.

Setiap titik sensor menampilkan:
- Identitas titik sensor.
- Posisi rak.
- Suhu.
- Kelembapan.
- Status sensor.

Gunakan indikator hijau untuk sensor normal dan abu-abu untuk sensor offline.

Jika sensor mengalami error, tampilkan indikator critical berwarna merah dengan ikon dan label yang jelas.

Pastikan layout dapat berubah menjadi satu kolom pada layar kecil.

Jangan mengubah pemetaan sensor maupun sumber data yang digunakan.

### 4.6. Grafik historis

Tingkatkan tampilan grafik agar lebih informatif dan konsisten dengan tema.

Ketentuan visual:
- Garis suhu menggunakan pink brand.
- Area di bawah garis menggunakan gradient pink yang transparan.
- Garis kelembapan menggunakan variasi pink yang lebih terang.
- Tampilkan grid yang halus.
- Gunakan tooltip yang mudah dibaca.
- Gunakan legenda yang jelas.
- Gunakan format angka yang konsisten.

Jika data batas kelembapan tersedia, tampilkan area referensi batas bawah dan batas atas RH sebagai pita visual pada grafik.

Area referensi tersebut harus menyesuaikan fase pertumbuhan yang aktif.

Jangan mengubah:
- Sumber data grafik.
- Query historis.
- Interval pengambilan data.
- Pengolahan data.
- Perhitungan statistik.
- Periode historis yang tersedia.

Jika menggunakan Recharts yang sudah ada, pertahankan implementasinya dan fokus pada styling serta presentasi.

### 4.7. Pengaturan batas kelembapan

Buat tampilan pengaturan batas RH yang lebih terstruktur.

Pisahkan pengaturan berdasarkan fase:
- Vegetatif.
- Generatif.

Gunakan input dengan border lembut, label jelas, dan satuan persen.

Tombol simpan menggunakan warna pink brand.

Pastikan seluruh input dan tombol tetap menggunakan fungsi penyimpanan yang sudah tersedia.

Jangan mengubah validasi, struktur data, atau proses penyimpanan.

### 4.8. Status perangkat dan sistem

Buat bagian status perangkat yang mudah dipahami.

Informasi yang ditampilkan dapat meliputi:
- Status koneksi perangkat.
- Waktu terakhir menerima data.
- Status sistem.
- Status sensor.
- Status keamanan kontrol pompa.

Jika perangkat OFFLINE:
- Tampilkan banner yang jelas.
- Sertakan informasi sejak kapan perangkat tidak aktif jika informasi tersebut tersedia.
- Gunakan warna abu-abu.
- Kurangi intensitas visual dashboard secara proporsional jika diperlukan.
- Jangan membuat data sensor terlihat seolah-olah masih diperbarui.

Jika terjadi kondisi critical:
- Gunakan warna merah.
- Sertakan ikon dan keterangan.
- Pastikan informasi tetap mudah dibaca.

Jangan mengubah mekanisme penentuan status perangkat.

---

## 5. Micro-interactions dan Animasi

Gunakan animasi secara terbatas dan fungsional.

Prioritaskan tiga animasi yang berjalan secara berkelanjutan:

1. Indikator LIVE yang berkedip lembut.
2. Animasi kabut atau tetesan air ketika pompa ON.
3. Highlight singkat pada nilai yang berubah ketika menerima pembaruan data.

Animasi tambahan:
- Animasi masuk kartu hanya sekali ketika halaman pertama kali dimuat.
- Transisi segmented control ketika pengguna mengganti pilihan.
- Transisi halus ketika membuka atau menutup komponen.

Hindari:
- Animasi berlebihan pada seluruh kartu.
- Efek hover pada elemen yang tidak interaktif.
- Animasi masuk ulang setiap kali Supabase Realtime mengirim data.
- Spinner yang terus berjalan tanpa alasan.
- Efek yang mengganggu pembacaan angka.

Pada perangkat touch:
- Jangan mengandalkan hover untuk menampilkan informasi penting.
- Pastikan interaksi dapat dilakukan melalui tap.
- Pastikan tombol memiliki ukuran area sentuh yang nyaman.

Hormati preferensi `prefers-reduced-motion`.

---

## 6. Responsivitas

Desain harus berfungsi dengan baik pada:

- Desktop.
- Laptop.
- Tablet.
- Smartphone.

Prioritas utama adalah memastikan seluruh informasi tetap mudah dibaca pada layar kecil.

Ketentuan:
- Hindari horizontal overflow.
- Jangan memaksakan dua kolom jika lebar layar tidak mencukupi.
- Susun ulang kartu berdasarkan prioritas informasi.
- Grafik harus tetap terbaca.
- Tombol dan input tidak boleh terlalu kecil.
- Navigasi harus tetap mudah digunakan.
- Gauge harus menyesuaikan ukuran layar.

Jangan menghilangkan fitur hanya untuk membuat tampilan mobile lebih sederhana.

---

## 7. Batasan Teknis Khusus

Beberapa hal berikut boleh diperhatikan dalam implementasi UI, tetapi jangan dijadikan alasan untuk mengubah arsitektur atau logika aplikasi.

### 7.1. Hydration

Jika informasi waktu terakhir diperbarui menggunakan waktu lokal browser, pastikan tampilannya tidak menyebabkan hydration mismatch.

Penyesuaian hanya boleh dilakukan pada mekanisme rendering UI yang diperlukan. Jangan mengubah sumber data atau mekanisme pembaruan data.

### 7.2. Responsive chart

Pastikan komponen grafik memiliki parent dengan tinggi yang jelas agar dapat dirender dengan benar.

Pertahankan data dan konfigurasi fungsional grafik yang sudah ada.

### 7.3. Realtime updates

Perubahan data Realtime tidak boleh menyebabkan seluruh dashboard melakukan animasi masuk ulang.

Highlight hanya pada nilai yang benar-benar berubah.

Jangan mengubah mekanisme Realtime untuk mencapai efek visual tersebut.

---

## 8. Tahapan Pengerjaan

Lakukan pekerjaan secara bertahap agar risiko merusak project dapat diminimalkan.

### Tahap 1 — Audit UI

- Periksa struktur project.
- Identifikasi halaman dan komponen UI yang sudah ada.
- Identifikasi styling dan design system saat ini.
- Identifikasi komponen yang mencampurkan presentasi dengan logika.
- Catat bagian yang aman untuk dimodifikasi.

Jangan melakukan perubahan sebelum memahami implementasi UI yang sudah ada.

### Tahap 2 — Design system

Terapkan:
- Palet warna.
- Typography.
- Background.
- Border.
- Shadow.
- Radius.
- Spacing.
- Style tombol dan input.

Pastikan seluruh halaman menggunakan identitas visual yang konsisten.

### Tahap 3 — Redesign komponen

Kerjakan secara bertahap:
1. Header dan navigasi.
2. Kartu kondisi kumbung.
3. Kontrol dan fase.
4. Visualisasi pompa.
5. Grid enam sensor.
6. Grafik historis.
7. Pengaturan batas RH.
8. Status perangkat.

### Tahap 4 — Responsive dan animasi

- Sesuaikan layout untuk berbagai ukuran layar.
- Implementasikan micro-interactions.
- Periksa perilaku pada perangkat touch.
- Pastikan animasi tidak mengganggu fungsi aplikasi.

### Tahap 5 — Validasi

Setelah perubahan UI selesai, pastikan:

- Aplikasi dapat dijalankan seperti sebelumnya.
- Login dan logout tetap berfungsi.
- Data sensor tetap masuk dan ditampilkan.
- Pembaruan Realtime tetap berjalan.
- Status perangkat tetap akurat.
- Kontrol pompa tetap berfungsi.
- Pergantian fase tetap berfungsi.
- Pengaturan batas RH tetap dapat disimpan.
- Grafik tetap menggunakan data aktual.
- Tidak ada error baru akibat perubahan UI.
- Tampilan desktop dan mobile berfungsi dengan baik.

Jika menemukan masalah teknis yang sudah ada sebelum perubahan UI, laporkan secara terpisah. Jangan melakukan perbaikan di luar ruang lingkup tanpa persetujuan.

---

## 9. Instruksi Akhir

Prioritaskan kualitas visual, konsistensi, keterbacaan, dan pengalaman pengguna.

Gunakan mockup yang diberikan sebagai referensi visual utama, tetapi sesuaikan implementasinya dengan struktur project yang sudah ada.

Jangan menyalin mockup secara membabi buta jika hal tersebut mengharuskan perubahan pada fungsi atau struktur teknis.

**SEKALI LAGI: PROJECT INI SUDAH BERJALAN DENGAN BENAR. TUGASMU ADALAH MEMPERBAIKI TAMPILAN UI/UX, BUKAN MEMBANGUN ULANG APLIKASI.**

Tidak boleh ada perubahan pada:
- Backend.
- Database.
- API.
- MQTT.
- Firmware.
- Data flow.
- Business logic.
- Struktur project.
- Kontrak data.
- Mekanisme autentikasi.
- Mekanisme kontrol perangkat.

Kecuali perubahan presentasi yang benar-benar diperlukan, seluruh implementasi yang sudah ada harus dipertahankan.

Jika ada keraguan apakah suatu perubahan termasuk UI atau teknis, **jangan mengubahnya terlebih dahulu. Laporkan dan minta persetujuan.**

Hasil akhir yang diharapkan adalah aplikasi dengan tampilan Soft Pink Modern yang profesional, responsif, dan interaktif, tanpa mengorbankan satu pun fungsi sistem yang sudah berjalan.