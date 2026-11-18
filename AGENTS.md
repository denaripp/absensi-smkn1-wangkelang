# AGENTS.md — Sistem Absensi SMK Negeri 1 Wangkelang

Dibaca sebelum menyentuh kode. Kalau isi file ini bertabrakan dengan kode, **kode menang** — lalu perbarui file ini. Rencana kerja & catatan tiap batch ada di `docs/PLAN.md`. Kebutuhan produk di `docs/PRD.md`. Desain di `docs/DESIGN.md`.

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

Backend **Supabase** (project `absensi`, ref `xlnrgtwqyzrwrchdczvf`). Hanya role `GURU` dan `SISWA`, tanpa ADMIN.

## Perintah

```bash
npm run tipe                        # tsc --noEmit, wajib exit 0
npm run lint                        # eslint ., wajib 0 error
npm run build                       # next build, wajib lolos
npm run uji                         # node --test tests/*.test.ts (24 test)
npx next start -p 3100              # server produksi lokal
node --experimental-strip-types --env-file=.env.local scripts/cek-koneksi.ts
node --experimental-strip-types --env-file=.env.local scripts/seed-demo.ts
node scripts/buat-template-siswa.cjs
```

Urutan gate tiap perubahan: `npm run uji` → `npm run tipe` → `npm run lint` → `npm run build` → uji curl/DB nyata. Jangan lapor selesai tanpa kelima langkah itu.

## Aturan Next 16 di proyek ini

1. `export const dynamic` **dilarang**. Pakai `export const instant = false` di `page.tsx` + `await connection()`.
2. Jangan taruh `connection()` atau query DB di `src/app/layout.tsx` — build mati di `/_not-found`.
3. Guard auth **wajib** di `src/proxy.ts` yang mengekspor `proxy`. `middleware.ts` deprecated. `redirect()` di layout terjadi setelah streaming → respons `200` berisi markup halaman yang seharusnya ditolak.
4. `src/proxy.ts` melewati jalur `/api/**` — route handler mengurus auth sendiri dan harus bisa membalas JSON 401/403, bukan redirect 307.
5. `cacheComponents` adalah opsi **top-level**, bukan `experimental`. `experimental.cacheComponents` deprecated di 16.4.6.
6. Layout yang membaca cookie dibungkus `<Suspense>` (lihat `(guru)/layout.tsx`), kalau tidak prerender gagal.
7. `next build` menulis ulang `tsconfig.json` (`jsx: react-jsx`, `include` += `.next/dev/types/**/*.ts`). Biarkan.
8. Teks Indonesia untuk semua copy yang dilihat pengguna.

## Struktur modul

| Area | Rute | Catatan |
| :--- | :--- | :--- |
| Auth | `/`, `/register-guru`, `/ganti-sandi` | login NISN/NIP, daftar guru pakai kode sekolah |
| Guru | `/guru`, `/guru/murid`, `/guru/kelas`, `/guru/mapel`, `/guru/rekap` | shell `(guru)` + Dock + TopBar |
| Siswa | `/siswa`, `/siswa/scan` | bento + scanner QR + jalur cadangan `?token=` |
| API auth | `/api/auth/{login,logout,ganti-sandi}`, `/api/register-guru` | |
| API sesi | `/api/sesi/{buka,tutup,manual}`, `/api/qr` | QR = HMAC stateless |
| API absensi | `/api/absen` | dipakai scanner & `/siswa/scan` |
| API data | `/api/{siswa,siswa/import,siswa/[id],kelas,kelas/[id],mapel,mapel/[id],reset-device}` | CRUD, otorisasi kelas di `src/lib/otoritas.ts` |
| API laporan | `/api/rekap/export` | `.xlsx` via SheetJS |

Library penting: `src/lib/qr.ts` (HMAC), `src/lib/device.ts` (fingerprint + guard), `src/lib/otoritas.ts` (kelas yang diampu), `src/lib/limit.ts` (rate limit), `src/lib/rekap.ts` (metrik & tren), `src/lib/format.ts` (WIB).

## Keamanan (tidak bisa dinegosiasi)

- `SUPABASE_SERVICE_ROLE_KEY` hanya di server. Semua tulis lewat route handler dengan `createAdminClient()`.
- Browser hanya membaca, dibatasi RLS (`db/002_rls.sql`). **Tidak ada** policy INSERT/UPDATE/DELETE untuk `authenticated`.
- `public.users.id` = FK `auth.users(id)`. Auth memakai Supabase Auth, bukan kolom `password_hash`. Akun dibuat lewat `admin.createUser({ email_confirm: true })`.
- Login siswa: password diverifikasi **sebelum** cek perangkat. Device mismatch → `signOut()` + audit `MISMATCH`.
- Password awal = NISN/NIP; `must_change_password = true` untuk akun baru (seed demo menyetel `false` agar bisa dipakai langsung).
- Token QR = HMAC `sessionId.bucket.sig`, bucket 15 detik, toleransi 1 bucket. Secret `QR_HMAC_SECRET` server-only.
- Device lock: `device_lock_id` (UUID localStorage) + `device_fingerprint` (SHA-256 dari UA, platform, layar, zona waktu).
- Rate limit: `POST /api/absen` 10/menit/IP, `POST /api/auth/login` 10/menit/IP (`src/lib/limit.ts`). Memori per-instance.
- `SCHOOL_SECRET_CODE` hanya divalidasi di route handler (timing-safe).
- Otorisasi guru: hanya kelas yang punya jadwal/sesi miliknya (`kelasDiampu`). Hapus kelas ditolak bila masih ada siswa; hapus mapel ditolak bila sudah dipakai sesi.
- Tanggal "hari ini" selalu `Asia/Jakarta`.

## Data

Tabel: `classes`, `users`, `teacher_subjects`, `schedules`, `sessions`, `attendance_logs`, `device_lock_audit`.

Constraint penting: sesi unik per `(class_id, subject_id, session_date)`; satu sesi `ACTIVE` per kelas; absensi unik per `(session_id, student_id)`; jadwal unik per `(class_id, day_of_week, jam_ke)`.

Status absensi: `HADIR`, `HADIR_MANUAL`, `SAKIT`, `IZIN`, `ALPA`. Persentase hadir = (`HADIR` + `HADIR_MANUAL`) / total log.

## Data demo (hasil `scripts/seed-demo.ts`, idempoten)

- Kelas `XII RPL 1` — Rekayasa Perangkat Lunak, tingkat XII
- Guru `198705122010011004` / sandi `GuruBaru#2026` (berubah karena uji ganti sandi)
- 3 mapel: Pemrograman Web & Perangkat Bergerak, Basis Data, Produk Kreatif dan Kewirausahaan
- 5 jadwal: Senin–Jumat jam ke-1, 07:00–08:30
- 36 siswa NISN `0061234501`–`0061234536`, sandi = NISN, `must_change_password=false`

## Jebakan host (Windows 11, git-bash MSYS)

- Shell adalah bash MSYS. Tool native butuh path `C:/...`, bukan `/c/...`.
- `npm config get omit` = `dev` di mesin ini → devDependencies **dilewati tanpa error**. Install wajib `NODE_ENV=development npm install --include=dev --maxsockets=1`.
- `package-lock.json` tidak bisa dibuat (`EALLOWREMOTE`). Jangan commit lock, jangan mengandalkannya.
- Restart `next start`: `taskkill` ke PID `npx` **tidak** membunuh child `node` → `EADDRINUSE`. Ambil PID nyata dari `netstat -ano | grep :3100`, lalu kill PID itu (`taskkill /F /PID <pid> /T`).
- Kamera laptop ini rusak (PnP OK, gambar hitam). Uji scan dari HP, atau lewat `/siswa/scan?token=<token>`.
- `curl -o /dev/null -w` di rantai `&&` bisa keluar dengan kode 23 dan menghentikan skrip; pakai `;` atau tulis ke file.

## Alur kerja

Satu perubahan = implementasi + semua gate hijau + laporan berisi output nyata (exit code, respons curl, hasil query). Jangan menumpuk perubahan besar di atas fondasi yang belum diverifikasi.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
