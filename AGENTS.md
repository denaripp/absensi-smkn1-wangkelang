# AGENTS.md — Sistem Absensi SMK Negeri 1 Wangkelang

Dibaca sebelum menyentuh kode. Kalau isi file ini bertabrakan dengan kode, **kode menang** — lalu perbarui file ini. Rencana kerja lengkap ada di `docs/PLAN.md` (mengikat, per batch). Kebutuhan produk di `docs/PRD.md`. Desain di `docs/DESIGN.md`.

## Stack (terpasang dan terverifikasi)

| Bagian | Versi |
| :--- | :--- |
| Next.js | 16.4.6 (App Router, Turbopack, `cacheComponents` + `partialPrefetching`) |
| React | 19.3.1 |
| Tailwind CSS | 4.3.5 lewat `@tailwindcss/postcss` |
| TypeScript | 5.9.3 |
| ESLint | 9.39.5 + `eslint-config-next` 16.4.6 (flat config) |
| Supabase | `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7 |
| QR | `qrcode.react` 4.2.0, `html5-qrcode` 2.3.8 |
| Excel | `xlsx` 0.18.5 |
| Ikon | Font Awesome 7.3.1 + `@fortawesome/react-fontawesome` 3.5.0 |

Backend **Supabase** (project `absensi`, ref `xlnrgtwqyzrwrchdczvf`). Tidak ada InsForge di repo ini. Tidak ada role ADMIN — hanya `GURU` dan `SISWA`.

## Perintah

```bash
npm run tipe                        # tsc --noEmit, wajib exit 0
npm run lint                        # eslint ., wajib 0 error
npm run build                       # next build, wajib lolos
npm run uji                         # node --test tests/*.test.ts
npx next start -p 3100              # server produksi lokal
node --experimental-strip-types --env-file=.env.local scripts/cek-koneksi.ts
node --experimental-strip-types --env-file=.env.local scripts/seed-demo.ts
```

Urutan gate tiap batch: `npm run uji` → `npm run tipe` → `npm run lint` → `npm run build` → uji curl/DB nyata. Jangan lapor selesai tanpa kelima langkah itu.

## Aturan Next 16 di proyek ini

1. `export const dynamic` **dilarang**. Pakai `export const instant = false` di `page.tsx` + `await connection()`.
2. Jangan taruh `connection()` atau query DB di `src/app/layout.tsx` — build mati di `/_not-found`.
3. Guard auth **wajib** di `src/proxy.ts` yang mengekspor `proxy`. `middleware.ts` sudah deprecated. `redirect()` di layout terjadi setelah streaming → respons `200` berisi markup halaman yang seharusnya ditolak.
4. `export const instant = false` harus di `page.tsx`, bukan hanya `layout.tsx`.
5. `cacheComponents` adalah opsi **top-level**, bukan `experimental`. `experimental.cacheComponents` deprecated di 16.4.6.
6. `next build` menulis ulang `tsconfig.json` (`jsx: react-jsx`, `include` += `.next/dev/types/**/*.ts`). Biarkan, jangan dikembalikan manual.
7. Teks Indonesia untuk semua copy yang dilihat pengguna.

## Desain (rujuk `docs/DESIGN.md`, jangan improvisasi)

- Kanvas `#F4F5F7`, kartu `#FFFFFF`, aksen lime `#8CE827` (hover `#7BE11D`), teks `#111827` / `#6B7280`, garis `#EAECF0`, kartu gelap `#0F172A`.
- Status: hadir `#22C55E`, sakit `#A855F7`, izin `#F59E0B`, alpa `#EF4444`.
- Radius: kontainer `rounded-3xl`, kartu `rounded-2xl`, tombol/pil/badge `rounded-full`. Shadow tipis, tanpa bayangan berwarna.
- Font Plus Jakarta Sans (fallback `system-ui`). Angka yang berubah: `tabular-nums`.
- DNA Monetra: dock kiri ikon-only, topbar pil, grafik batang satu batang highlight + tooltip hitam, avatar bertumpuk, satu kartu gelap premium.

## Aturan UI

- Tombol yang belum punya backend tetap bisa diklik dan menampilkan alasan (`AksiTombol`). Jangan render tombol mati tanpa keterangan.
- Nav ke rute yang belum ada: `aria-disabled` + `title`, bukan `<Link>` menuju 404.
- Jangan tampilkan data palsu yang terlihat nyata. Angka contoh wajib jelas sebagai placeholder atau diisi data DB sungguhan.

## Keamanan (tidak bisa dinegosiasi)

- `SUPABASE_SERVICE_ROLE_KEY` hanya di server (tanpa prefiks `NEXT_PUBLIC_`). Semua tulis absensi lewat route handler dengan `createAdminClient()`.
- Browser hanya membaca, dibatasi RLS. Policy ada di `db/002_rls.sql`. **Tidak ada** policy INSERT/UPDATE/DELETE untuk `authenticated`.
- `public.users.id` = FK `auth.users(id)`. Auth memakai Supabase Auth, bukan kolom `password_hash`. `mailer_autoconfirm = false` → akun wajib dibuat lewat `admin.createUser({ email_confirm: true })`.
- Password awal = NISN/NIP; `must_change_password = true` ditegakkan di `src/proxy.ts` → redirect `/ganti-sandi`.
- Token QR = HMAC stateless (`sessionId.bucket.sig`, bucket 15 detik, toleransi 1 bucket). Secret `QR_HMAC_SECRET` server-only, tidak pernah dikirim ke client.
- Device lock: `device_lock_id` (UUID localStorage) + `device_fingerprint` (SHA-256 dari UA, platform, resolusi layar, zona waktu). Divalidasi di server; mismatch → tolak + catat `device_lock_audit`. Reset hanya oleh guru yang mengampu kelas siswa itu.
- `SCHOOL_SECRET_CODE` hanya divalidasi di route handler, jangan pernah dikirim ke client.
- Tanggal "hari ini" selalu `Asia/Jakarta`.

## Data

Tabel: `classes`, `users`, `teacher_subjects`, `schedules`, `sessions`, `attendance_logs`, `device_lock_audit`. Detail di `db/001_schema.sql` dan `db/002_rls.sql`.

Aturan integritas: sesi unik per `(class_id, subject_id, session_date)`; hanya satu sesi `ACTIVE` per kelas; absensi unik per `(session_id, student_id)`; status `HADIR` / `HADIR_MANUAL` / `SAKIT` / `IZIN` / `ALPA`.

## Jebakan host (Windows 11, git-bash MSYS)

- Shell adalah bash MSYS. Tool native butuh path `C:/...`, bukan `/c/...`.
- `npm config get omit` = `dev` di mesin ini → devDependencies **dilewati tanpa error**. Install wajib `NODE_ENV=development npm install --include=dev --maxsockets=1`.
- `package-lock.json` tidak bisa dibuat (`EALLOWREMOTE`). Jangan commit lock, jangan mengandalkannya.
- `npm install` gampang kena `ECONNRESET` pada tarball besar → `--maxsockets=1`.
- Restart `next start`: `taskkill` ke PID `npx` **tidak** membunuh child `node` → `EADDRINUSE`. Ambil PID nyata dari `netstat -ano | grep :3100`, lalu kill PID itu (`taskkill /F /PID <pid> /T`).
- Kamera laptop ini rusak (PnP OK, gambar hitam). Uji scan dari HP, atau lewat URL `/siswa/scan?token=<token>`.

## Alur kerja

Kerjakan per batch sesuai `docs/PLAN.md`. Satu batch = implementasi + semua gate hijau + laporan berisi output nyata (exit code, respons curl, hasil query). Batch berikutnya tidak dimulai sebelum batch sebelumnya hijau.
