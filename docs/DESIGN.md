# DESIGN.md — Sistem Absensi SMK Negeri 1 Wangkelang

Acuan visual: render `absensi_dash2.png` (dashboard guru) yang diturunkan dari referensi **Monetra** (dashboard fintech, Pinterest). Dokumen ini adalah sumber kebenaran desain. Jangan improvisasi warna, radius, atau struktur grid tanpa memperbarui file ini.

## 1. DNA desain yang diwarisi dari referensi Monetra

1. Aksen tunggal hijau lime yang agresif; sisanya netral putih/abu terang.
2. Satu kartu gelap premium (kartu identitas) sebagai penyeimbang kontras.
3. Rail/dock navigasi kiri berisi ikon saja, tanpa label teks.
4. Topbar dengan menu berbentuk pil; item aktif memakai pil gelap.
5. Grafik batang minimalis tanpa sumbu Y menonjol; satu batang disorot warna aksen dengan tooltip hitam.
6. Avatar bertumpuk (overlapping stack) untuk menandai siswa yang baru hadir.
7. Angka metrik besar, label kecil uppercase dengan tracking lebar.
8. Radius besar dan konsisten, bayangan sangat tipis, banyak ruang kosong.

## 2. Token warna

| Token | Hex | Pemakaian |
| :--- | :--- | :--- |
| Kanvas | `#F4F5F7` | Latar halaman |
| Kartu | `#FFFFFF` | Semua kartu dan dock |
| Aksen | `#8CE827` | Tombol utama, QR frame, batang grafik aktif, pil status positif |
| Aksen hover | `#7BE11D` | Hover tombol aksen |
| Aksen lembut | `#ECFCCB` | Latar pill/badge hijau muda |
| Teks utama | `#111827` | Judul, angka metrik |
| Teks sekunder | `#6B7280` | Label, subteks, keterangan |
| Border | `#EAECF0` | Garis pemisah, border kartu |
| Kartu gelap | `#0F172A` | Kartu identitas guru, tooltip grafik |
| Hadir | `#22C55E` | Ikon dan teks status hadir |
| Sakit | `#A855F7` | Ikon status sakit, latar `#F3E8FF` |
| Izin | `#F59E0B` | Ikon status izin, latar `#FEF3C7` |
| Alpa | `#EF4444` | Ikon status alpa, latar `#FEE2E2` |

## 3. Radius, bayangan, tipografi

1. Radius: kontainer `rounded-3xl` (24px), kartu `rounded-2xl` (16-20px), tombol/pil/badge `rounded-full`, panel QR 20px, dock 28-32px.
2. Bayangan: sangat tipis dan lembut. Tidak ada bayangan berwarna.
3. Font: Plus Jakarta Sans (fallback Inter), dimuat via `next/font`.
4. Skala: judul halaman 30px bold, judul kartu 18-20px semibold, angka metrik 30-34px bold, body 13-14px, label uppercase 11-12px dengan tracking lebar.
5. Semua angka yang berubah memakai `tabular-nums`.

## 4. Struktur layout dashboard guru

1. Grid 12 kolom, jarak antar kartu 16-20px, margin halaman 24-32px.
2. Dock kiri: kolom vertikal melayang berisi logo hijau, tombol gelap berindikator hijau, lalu ikon kalender, grup siswa, grafik batang, pengaturan, bantuan, logout.
3. Topbar: pil menu Dashboard / Sesi Hari Ini / Rekap Mapel / Jadwal (aktif = pil gelap), kolom pencarian berbentuk pil, lonceng dengan badge angka, avatar inisial dengan indikator hijau.
4. Header halaman: baris tanggal uppercase, sapaan guru, subjudul kelas, dan badge sesi di sisi kanan.
5. Baris pertama grid: kartu Sesi Aktif + QR (5 kolom), metrik kehadiran 2x2 (4 kolom), sidebar widget (3 kolom).
6. Baris kedua grid: kartu Tren Kehadiran Mingguan membentang 9 kolom, sidebar aksi di 3 kolom kanan.
7. Footer: teks kecil nama sekolah di kiri bawah.

## 5. Komponen wajib

1. Kartu Sesi Aktif: pil "SESI AKTIF", judul mapel, subteks kelas dan ruang, tombol aksen "+ Buka Sesi Baru", penghitung "34/36 sudah absen", panel QR, instruksi "Scan via HP Siswa", catatan "Token bergulir otomatis tiap 15 detik", timer sisa detik dengan progress bar aksen.
2. Metrik 2x2: Hadir / Sakit / Izin / Alpa, masing-masing dengan ikon berwarna, angka besar, dan keterangan pendek.
3. Grafik batang: label Sen sampai Jum, batang abu `#EAECF0`, satu batang aksen dengan tooltip hitam berisi rasio kehadiran, toggle Minggu/Bulan.
4. Widget "Siswa Baru Saja Hadir": label waktu relatif, tumpukan avatar, ringkasan nama.
5. Kartu identitas guru gelap: badge "GURU PENGAMPU", label "NOMOR INDUK PEGAWAI", NIP, nama lengkap, jurusan, pil kelas.
6. Action bar: tombol `Hadir Manual` (aksen) dan `Tutup Sesi` (ikon kunci).
7. Ringkasan rekap: persentase besar, semester, progress bar tipis, total pertemuan, kehadiran rata-rata, tombol "Unduh Laporan Excel".

## 6. Dashboard siswa

1. Header profil: inisial atau foto, nama, NISN, kelas, badge "Perangkat Terkunci (HP Ini)".
2. Kartu sesi aktif: menyala hijau lime saat guru membuka sesi, memuat nama mapel, nama guru, sisa waktu, dan tombol besar "Buka Kamera & Scan Sekarang". Saat tidak ada sesi, tampil pesan tenang netral.
3. Metrik pribadi 2x2: Hadir beserta persentase, Sakit, Izin, Alpa.
4. Jadwal hari ini: daftar vertikal mapel dan jam mulai-selesai beserta status.
5. Riwayat presensi: lima entri terakhir dengan tanggal, jam scan sampai detik, nama mapel, badge status berwarna.

## 7. Aturan UI

1. Tombol yang belum punya backend tetap dapat diklik dan menampilkan alasan, tidak boleh disabled tanpa keterangan.
2. Navigasi ke rute yang belum ada memakai `aria-disabled` dan `title`, bukan tautan menuju 404.
3. Dilarang menampilkan data palsu yang terlihat nyata. Angka contoh harus jelas sebagai placeholder atau diisi data DB sungguhan.
4. Mode gelap tidak termasuk lingkup; hanya satu tema terang.
