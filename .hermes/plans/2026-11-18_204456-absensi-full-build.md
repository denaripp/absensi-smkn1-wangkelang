# Sistem Absensi SMK Negeri 1 Wangkelang — Implementation Plan (Full Build, v1)

> **For Hermes:** eksekusi plan ini per batch (`kerjakan batch N`). Setiap batch wajib lolos gate verifikasi sebelum lanjut. Jangan lompati gate.

**Goal:** Membangun ulang 100% web absensi SMKN 1 Wangkelang dari nol — Next.js 16 App Router + Supabase (Postgres + Auth + Realtime) — dengan dua dashboard mandiri (Guru & Siswa), presensi Dynamic QR 15 detik, Device Lock 1 HP 1 akun, CRUD kelas/murid/mapel, import & ekspor Excel.

**Architecture:** Render server-first. Semua tulis ke DB lewat route handler dengan `SUPABASE_SERVICE_ROLE_KEY`; browser hanya baca dan dibatasi RLS. Autentikasi pakai Supabase Auth (`users.id` = FK `auth.users`), jadi RLS dan Realtime bisa pakai `auth.uid()`. Token QR = HMAC stateless (`sessionId.bucket.sig`, bucket 15 detik), tidak ada tulisan DB tiap rotasi. Guard role di `src/proxy.ts` (bukan layout). Realtime memakai Postgres Changes pada tabel `sessions` dan `attendance_logs` dengan filter kelas.

**Tech Stack:** Next.js 16.4.6 (App Router, Turbopack, `cacheComponents`), React 19.3.0, Tailwind CSS 4.3.3 (`@tailwindcss/turbopack`), `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7, `qrcode.react` 4.2.0, `html5-qrcode` 2.3.8, `xlsx` 0.18.5, Font Awesome 7.3.1, plus `clsx` + `tailwind-merge`.

**Sumber desain:** `docs/DESIGN.md` (sudah final: kanvas `#F4F5F7`, kartu putih `rounded-2xl`, aksen lime `#8CE827`, kartu gelap `#0F172A`, dock kiri ikon-only, grafik batang 1 batang highlight + tooltip hitam).

---

## 0. Status Awal (terverifikasi, bukan asumsi)

| Item | Kondisi nyata |
| :--- | :--- |
| Folder proyek | `C:\projectt web\dummy\absensi-smk-negri1-wangkelang` — kosong, hanya berisi `docs/DESIGN.md` |
| Supabase project | `absensi` = `xlnrgtwqyzrwrchdczvf`, status `ACTIVE_HEALTHY`, region `ap-northeast-1` |
| Isi DB | **0 tabel**, **0 policy**, **0 function**, **0 auth user** (sudah direset, migrasi terakhir `reset_bersih_absensi`) |
| URL Supabase | `https://xlnrgtwqyzrwrchdczvf.supabase.co` |
| Node | `v22.23.2` |
| npm | `12.0.2`, registry `https://registry.npmjs.org/` |
| Versi `next` terbaru di registry | `16.4.6` |
| Git | `.git` ikut terhapus saat reset → `git init` ulang di Batch 1 |

## 1. Keputusan Teknis Final (mengikat, jangan diubah tanpa revisi plan)

| # | Topik | Keputusan | Alasan |
| :--- | :--- | :--- | :--- |
| 1 | Auth | **Supabase Auth**. `public.users.id` = FK `auth.users(id) on delete cascade`. Tanpa kolom `password_hash`. | RLS + Realtime butuh `auth.uid()`. |
| 2 | Mapel | Tabel `teacher_subjects`; `sessions.subject_id` **FK**, bukan `subject_name` varchar. | Rename mapel tidak memecah rekap. |
| 3 | Jadwal | **Tabel baru `schedules`** (class, subject, hari, jam ke, jam mulai, jam selesai). | Syarat mutlak fitur "Jadwal Hari Ini" + grafik tren Senin–Jumat. |
| 4 | Sesi | `sessions.session_date` + unique `(class_id, subject_id, session_date)` + partial unique `(class_id) where status='ACTIVE'`. | Cegah sesi dobel & dua sesi aktif di kelas sama. |
| 5 | Absensi | unique `(session_id, student_id)`. | Cegah double scan, counter tidak bisa lewat kapasitas. |
| 6 | QR | **HMAC stateless**: `sessionId.bucket.sig`, bucket = 15000 ms, toleransi 1 bucket (15 detik grace). Secret `QR_HMAC_SECRET` server-only. Tanpa kolom `current_qr_token`. | Nol tulisan DB, rotasi deterministik, aman dari screenshot lama (>30s mati). |
| 7 | Device lock | `device_lock_id` (UUID localStorage) **+** `device_fingerprint` (SHA-256 dari UA+platform+screen+timezone). Mismatch → tolak login + audit. | Hapus localStorage saja tidak cukup untuk pindah HP. |
| 8 | Registrasi guru | Route handler `POST /api/register-guru` validasi `SCHOOL_SECRET_CODE` di server, lalu `admin.createUser({ email_confirm: true })`. | Kode master tidak pernah ke client. |
| 9 | Password awal | `must_change_password = true` untuk semua akun baru (guru & siswa), ditegakkan di `proxy.ts` → redirect `/ganti-sandi`. | Standar keamanan. |
| 10 | Guard | Role guard di `src/proxy.ts`, layout hanya lapis kedua. | Next 16: `redirect()` di layout terjadi setelah streaming = bocor 200 + markup. |
| 11 | Next 16 | Dilarang `export const dynamic`. Pakai `export const instant = false` di `page.tsx` + `await connection()` sebelum sentuh Supabase saat render. | Aturan `cacheComponents`. |
| 12 | Wewenang guru | Guru hanya boleh kelola murid/kelas **yang ia ampu** (punya jadwal atau sesi di kelas itu). Override ADMIN tidak ada. | PRD tanpa role admin, jadi batas harus eksplisit. |
| 13 | Zona waktu | Semua tanggal "hari ini" pakai `Asia/Jakarta` (`(now() at time zone 'Asia/Jakarta')::date`). | Server Vercel UTC, sekolah WIB. |
| 14 | Status absensi | `HADIR`, `HADIR_MANUAL`, `SAKIT`, `IZIN`, `ALPA`. Persentase hadir = (`HADIR` + `HADIR_MANUAL`) / total log. | Sesuai PRD. |

---

## 2. Skema Database (siap `apply_migration`)

Nama migrasi: `absensi_001_schema`.

```sql
-- ============ EXTENSIONS ============
create extension if not exists pgcrypto;

-- ============ CLASSES ============
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  class_name  varchar(64)  not null unique,          -- 'XII RPL 1'
  major       varchar(96)  not null,                 -- 'Rekayasa Perangkat Lunak'
  grade       varchar(4)   not null check (grade in ('X','XI','XII')),
  created_at  timestamptz  not null default now()
);

-- ============ USERS (id = auth.users.id) ============
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  identifier            varchar(64)  not null unique,  -- NISN siswa / NIP guru
  full_name             varchar(128) not null,
  role                  varchar(8)   not null check (role in ('GURU','SISWA')),
  class_id              uuid references public.classes(id) on delete set null,
  device_lock_id        uuid,
  device_fingerprint    text,
  device_locked_at      timestamptz,
  is_active             boolean      not null default true,
  must_change_password  boolean      not null default true,
  created_at            timestamptz  not null default now(),
  constraint siswa_wajib_kelas check (role <> 'SISWA' or class_id is not null)
);
create index users_class_idx on public.users (class_id) where role = 'SISWA';
create index users_role_idx  on public.users (role);

-- ============ TEACHER SUBJECTS ============
create table public.teacher_subjects (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.users(id) on delete cascade,
  subject_name  varchar(96) not null,
  created_at    timestamptz not null default now(),
  unique (teacher_id, subject_name)
);
create index subjects_teacher_idx on public.teacher_subjects (teacher_id);

-- ============ SCHEDULES ============
create table public.schedules (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  subject_id   uuid not null references public.teacher_subjects(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 1 and 6),  -- 1=Senin
  jam_ke       smallint not null check (jam_ke between 1 and 12),
  jam_mulai    time not null,
  jam_selesai  time not null,
  created_at   timestamptz not null default now(),
  unique (class_id, day_of_week, jam_ke),
  constraint jam_valid check (jam_selesai > jam_mulai)
);
create index schedules_class_idx on public.schedules (class_id, day_of_week);

-- ============ SESSIONS ============
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.users(id) on delete cascade,
  class_id      uuid not null references public.classes(id) on delete cascade,
  subject_id    uuid not null references public.teacher_subjects(id),
  schedule_id   uuid references public.schedules(id) on delete set null,
  session_date  date not null default ((now() at time zone 'Asia/Jakarta')::date),
  status        varchar(8) not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  unique (class_id, subject_id, session_date)
);
create unique index sessions_satu_aktif_per_kelas
  on public.sessions (class_id) where status = 'ACTIVE';
create index sessions_tanggal_idx on public.sessions (session_date desc);
create index sessions_teacher_idx on public.sessions (teacher_id);

-- ============ ATTENDANCE LOGS ============
create table public.attendance_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.users(id) on delete cascade,
  status      varchar(16) not null check (status in ('HADIR','HADIR_MANUAL','SAKIT','IZIN','ALPA')),
  scanned_at  timestamptz not null default now(),
  notes       text,
  unique (session_id, student_id)
);
create index logs_session_idx on public.attendance_logs (session_id);
create index logs_student_idx on public.attendance_logs (student_id, scanned_at desc);

-- ============ DEVICE LOCK AUDIT ============
create table public.device_lock_audit (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.users(id) on delete cascade,
  action           varchar(16) not null check (action in ('LOCK','MISMATCH','RESET')),
  old_fingerprint  text,
  new_fingerprint  text,
  actor_id         uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index audit_student_idx on public.device_lock_audit (student_id, created_at desc);

-- ============ REALTIME ============
alter table public.sessions          replica identity full;
alter table public.attendance_logs   replica identity full;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.attendance_logs;
```

## 3. RLS (migrasi `absensi_002_rls`)

Helper `security definer` wajib — kalau policy di `public.users` men-subquery `public.users`, Postgres melempar *infinite recursion detected in policy*.

```sql
alter table public.classes            enable row level security;
alter table public.users              enable row level security;
alter table public.teacher_subjects   enable row level security;
alter table public.schedules          enable row level security;
alter table public.sessions           enable row level security;
alter table public.attendance_logs    enable row level security;
alter table public.device_lock_audit  enable row level security;

create or replace function public.saya_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.saya_kelas()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.users where id = auth.uid()
$$;

-- ---------- READ POLICIES ----------
create policy classes_baca on public.classes
  for select to authenticated using (true);

create policy subjects_baca on public.teacher_subjects
  for select to authenticated using (true);

create policy schedules_baca on public.schedules
  for select to authenticated using (true);

create policy users_baca on public.users
  for select to authenticated using (id = auth.uid() or public.saya_role() = 'GURU');

create policy sessions_baca on public.sessions
  for select to authenticated using (
    teacher_id = auth.uid()
    or (public.saya_role() = 'SISWA' and class_id = public.saya_kelas())
  );

create policy logs_baca on public.attendance_logs
  for select to authenticated using (
    student_id = auth.uid()
    or exists (
      select 1 from public.sessions s
      where s.id = attendance_logs.session_id and s.teacher_id = auth.uid()
    )
  );

create policy audit_baca on public.device_lock_audit
  for select to authenticated using (public.saya_role() = 'GURU');
```

Tidak ada policy INSERT/UPDATE/DELETE untuk `authenticated` — semua tulis lewat server dengan service role. Ini yang menutup celah titip absen via DevTools.

## 4. Struktur File Lengkap

```
absensi-smk-negri1-wangkelang/
├─ .env.local                      # URL, ANON, SERVICE_ROLE, SCHOOL_SECRET_CODE, QR_HMAC_SECRET
├─ .env.example
├─ .gitignore
├─ AGENTS.md                       # aturan proyek (dibuat ulang, lihat Batch 1)
├─ docs/DESIGN.md                  # sudah ada
├─ db/001_schema.sql               # cermin migrasi 001 (versioned di repo)
├─ db/002_rls.sql                  # cermin migrasi 002
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
├─ tsconfig.json
├─ eslint.config.mjs
├─ public/logo-sekolah.svg
├─ scripts/
│  ├─ cek-koneksi.ts               # node --experimental-strip-types
│  ├─ buat-akun.ts                 # buat guru/siswa via admin API
│  ├─ seed-demo.ts                 # 1 kelas, 1 guru, 3 mapel, 5 jadwal, 36 siswa
│  ├─ import-siswa.ts              # CLI impor .xlsx (dipakai ulang oleh route handler)
│  ├─ buat-template-siswa.cjs      # template xlsx kosong
│  └─ uji-endpoint.cjs             # curl-as-code untuk gate verifikasi
├─ tests/
│  ├─ qr.test.ts
│  ├─ device.test.ts
│  └─ rekap.test.ts
└─ src/
   ├─ app/
   │  ├─ layout.tsx                # font + globals, TANPA query DB
   │  ├─ globals.css               # @theme token desain
   │  ├─ page.tsx                  # / login (guru NIP | siswa NISN), instant=false
   │  ├─ register-guru/page.tsx
   │  ├─ ganti-sandi/page.tsx
   │  ├─ (guru)/
   │  │  ├─ layout.tsx             # shell: dock kiri + topbar
   │  │  ├─ guru/page.tsx          # dashboard sesi + QR + realtime counter
   │  │  ├─ guru/murid/page.tsx
   │  │  ├─ guru/kelas/page.tsx
   │  │  ├─ guru/mapel/page.tsx
   │  │  └─ guru/rekap/page.tsx
   │  ├─ (siswa)/
   │  │  ├─ layout.tsx             # shell siswa mobile-first
   │  │  └─ siswa/page.tsx         # bento siswa
   │  └─ api/
   │     ├─ auth/login/route.ts
   │     ├─ auth/logout/route.ts
   │     ├─ auth/ganti-sandi/route.ts
   │     ├─ register-guru/route.ts
   │     ├─ qr/route.ts            # GET token QR baru
   │     ├─ sesi/buka/route.ts
   │     ├─ sesi/tutup/route.ts    # auto-ALPA
   │     ├─ sesi/manual/route.ts   # Hadir Manual / Sakit / Izin
   │     ├─ absen/route.ts         # siswa scan → insert log
   │     ├─ siswa/route.ts         # POST tambah murid
   │     ├─ siswa/[id]/route.ts    # PATCH edit, DELETE hapus
   │     ├─ siswa/import/route.ts  # POST .xlsx
   │     ├─ reset-device/route.ts
   │     ├─ kelas/route.ts + kelas/[id]/route.ts
   │     ├─ mapel/route.ts + mapel/[id]/route.ts
   │     └─ rekap/export/route.ts  # GET .xlsx
   ├─ components/
   │  ├─ Dock.tsx
   │  ├─ TopBar.tsx
   │  ├─ KartuSesi.tsx
   │  ├─ TampilanQR.tsx
   │  ├─ MetrikBento.tsx
   │  ├─ GrafikTren.tsx
   │  ├─ KartuIdentitasGuru.tsx
   │  ├─ TabelSiswaLive.tsx
   │  ├─ ScannerQR.tsx             # client, html5-qrcode
   │  ├─ ModalTambahMurid.tsx
   │  ├─ UploadExcel.tsx
   │  └─ AksiTombol.tsx            # tombol tanpa backend → tampilkan alasan
   ├─ hooks/
   │  ├─ useSesiAktif.ts
   │  └─ useKehadiranLive.ts
   ├─ lib/
   │  ├─ supabase/server.ts        # SSR client (cookie)
   │  ├─ supabase/browser.ts       # createBrowserClient
   │  ├─ supabase/admin.ts         # service role
   │  ├─ qr.ts                     # HMAC token
   │  ├─ device.ts                 # fingerprint + guard
   │  ├─ auth.ts                   # requireRole() untuk route handler
   │  ├─ rekap.ts                  # hitung persentase & tren
   │  ├─ xlsx.ts                   # parse & build workbook
   │  └─ format.ts                 # tanggal WIB, jam detik, tabular
   └─ proxy.ts                     # role guard + must_change_password
```

## 5. Batch & Task

Setiap batch diakhiri gate verifikasi. Batch berikutnya tidak boleh mulai sebelum gate hijau.

### BATCH 1 — Fondasi proyek (scaffold, env, git)

**Task 1.1 — Inisialisasi git & package.json**
- Run: `git init && git config core.autocrlf false`
- Buat `package.json` manual (jangan `create-next-app`, biar bersih):

```json
{
  "name": "absensi-smkn1-wangkelang",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "tipe": "tsc --noEmit -p tsconfig.json",
    "uji": "node --experimental-strip-types --test tests/*.test.ts"
  },
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "7.3.1",
    "@fortawesome/free-solid-svg-icons": "7.3.1",
    "@fortawesome/react-fontawesome": "3.2.0",
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.119.0",
    "clsx": "2.1.1",
    "html5-qrcode": "2.3.8",
    "next": "16.4.6",
    "qrcode.react": "4.2.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "tailwind-merge": "2.5.4",
    "xlsx": "0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "eslint": "9.17.0",
    "eslint-config-next": "16.4.6",
    "tailwindcss": "4.3.3",
    "typescript": "5.7.2"
  }
}
```

- Run: `npm install --maxsockets=1` (mitigasi `ECONNRESET`).
- Expected: `node_modules/` ada, `npm ls next` → `next@16.4.6`.

**Task 1.2 — Config files**

`next.config.ts`:
```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { experimental: { cacheComponents: true } }
export default nextConfig
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

`tsconfig.json`: `paths: { "@/*": ["./src/*"] }`, `strict: true`, `exclude: ["node_modules", "scripts", "tests"]` (kalau tidak, `tsc` gagal `TS5097`).

`.gitignore`: `node_modules/ .next/ .env*.local *.tsbuildinfo .vercel/`

**Task 1.3 — Env**
- Ambil anon key: `mcp__supabase__get_publishable_keys` (project `xlnrgtwqyzrwrchdczvf`).
- Ambil service role dari dashboard Supabase → Settings → API.
- Buat `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xlnrgtwqyzrwrchdczvf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SCHOOL_SECRET_CODE=WANGKELANG2026
QR_HMAC_SECRET=<openssl rand -base64 48>
```
- `.env.example` versi kosong tanpa nilai.

**Gate 1:** `npm run tipe` → exit 0 (belum ada file src, buat `src/app/page.tsx` minimal dulu), `npx next build` → sukses.

---

### BATCH 2 — Database: schema + RLS + realtime

**Task 2.1** — `mcp__supabase__apply_migration` nama `absensi_001_schema`, isi SQL Bagian 2. Lalu simpan salinan ke `db/001_schema.sql`.
**Task 2.2** — `mcp__supabase__apply_migration` nama `absensi_002_rls`, isi SQL Bagian 3. Simpan ke `db/002_rls.sql`.
**Task 2.3** — Verifikasi via SQL (`mcp__supabase__execute_sql`):

```sql
select count(*) from information_schema.tables where table_schema='public';       -- 7
select count(*) from pg_policies where schemaname='public';                        -- 8
select tablename from pg_publication_tables where pubname='supabase_realtime';     -- sessions, attendance_logs
```
**Task 2.4** — `scripts/cek-koneksi.ts` (admin client + anon client, cek select dari `classes`), run:
`node --experimental-strip-types --env-file=.env.local scripts/cek-koneksi.ts`
Expected: `ADMIN OK`, `ANON OK (0 baris)`.

**Gate 2:** 7 tabel, 8 policy, 2 tabel di publication, `cek-koneksi` exit 0.

---

### BATCH 3 — Lib inti + unit test (TDD)

**Task 3.1 — `src/lib/qr.ts`** (kode final, Bagian 6.1). Test `tests/qr.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
process.env.QR_HMAC_SECRET = 'rahasia-uji'
const { buatToken, verifikasiToken } = await import('../src/lib/qr.ts')

test('token valid di bucket sekarang', () => {
  const { token } = buatToken('sesi-1', 1_000_000_000_000)
  assert.deepEqual(verifikasiToken(token, 1_000_000_000_000), { sessionId: 'sesi-1', bucket: 66666666 })
})
test('token mati setelah 2 bucket (30 detik)', () => {
  const { token } = buatToken('sesi-1', 1_000_000_000_000)
  assert.equal(verifikasiToken(token, 1_000_000_000_000 + 31_000), null)
})
test('token dengan sig diubah ditolak', () => {
  const { token } = buatToken('sesi-1', 1_000_000_000_000)
  const rusak = token.slice(0, -2) + 'zz'
  assert.equal(verifikasiToken(rusak, 1_000_000_000_000), null)
})
test('session id lain di dalam token tetap ditolak kalau sig tidak cocok', () => {
  const { token } = buatToken('sesi-A', 1_000_000_000_000)
  const [sid, b, sig] = token.split('.')
  assert.equal(verifikasiToken(`sesi-B.${b}.${sig}`, 1_000_000_000_000), null)
})
```
- Run: `npm run uji` → 4 pass.

**Task 3.2 — `src/lib/device.ts`** (fingerprint + `periksaDevice`). Test `tests/device.test.ts`:
- fingerprint deterministik (input sama → hash sama), beda input → hash beda, panjang 64 hex.

**Task 3.3 — `src/lib/rekap.ts`** — `hitungMetrik(logs)` → `{hadir, sakit, izin, alpa, persen}`; `trenMingguan(logs, sesi)` → `[{hari:'Sen', hadir:34, total:36}]`. Test `tests/rekap.test.ts`: 5 skenario termasuk 0 log (persen 0, bukan NaN).

**Task 3.4 — Supabase clients** `server.ts`, `browser.ts`, `admin.ts`, `src/lib/auth.ts` (`requireRole('GURU')` untuk route handler, return 401/403 JSON).

**Gate 3:** `npm run uji` → 9+ pass, `npm run tipe` → exit 0.

---

### BATCH 4 — Auth: login, register guru, ganti sandi, proxy guard

**Task 4.1 — `src/proxy.ts`** (Bagian 6.4). Guard: belum login → `/`; `must_change_password` → `/ganti-sandi`; role silang → redirect dashboard sendiri.
**Task 4.2 — `/` (`src/app/page.tsx`)** — login tab Guru (NIP/email) & Siswa (NISN) → `POST /api/auth/login`. `export const instant = false` + `await connection()`.
**Task 4.3 — `POST /api/auth/login`** — terima `{identifier, password, role, deviceLockId?, fingerprint?}`. Alur:
1. `admin.from('users').select('*').eq('identifier', identifier).single()` → 404 kalau kosong.
2. Role mismatch → 403.
3. Siswa: `periksaDevice()` → `LOCK` (pertama kali, simpan id+fingerprint), `OK`, atau `MISMATCH` (403 + audit).
4. `admin.auth.admin.generateLink({type:'password'})`? **Tidak.** Pakai `createServerSupabase().auth.signInWithPassword({ email: user_email, password })`. Email disimpan di `auth.users.email`; karena siswa login pakai NISN, saat `admin.createUser` set `email = `${identifier}@siswa.absensi.local`` dan `user_metadata.pseudo_email = true`.
5. Set cookie session (via `createServerClient` cookie adapter), return `{ok:true, role}`.
**Task 4.4 — `POST /api/register-guru`** — validasi `SCHOOL_SECRET_CODE` (timing-safe compare), `admin.createUser({ email, password, email_confirm: true })`, insert `public.users` role GURU, `must_change_password: true`. Kode salah → 403 tanpa bocor pesan.
**Task 4.5 — `/ganti-sandi` + `POST /api/auth/ganti-sandi`** — `auth.updateUser({password})` + `must_change_password=false`.
**Task 4.6 — `POST /api/auth/logout`** + tombol di dock.

**Gate 4 (curl nyata, server jalan di :3100):**
```bash
curl -s -X POST localhost:3100/api/register-guru -H 'content-type: application/json' \
  -d '{"nip":"198705122010011004","nama":"Rahmat Hidayat, S.Pd.","email":"rahmat@smkn1wangkelang.sch.id","password":"Guru#2026","kodeSekolah":"WANGKELANG2026"}'
# harap: {"ok":true}
curl -s -X POST localhost:3100/api/register-guru -H 'content-type: application/json' \
  -d '{"nip":"1","nama":"X","email":"x@y.z","password":"Guru#2026","kodeSekolah":"SALAH"}'
# harap: 403 {"error":"kode sekolah salah"}
curl -si -X POST localhost:3100/api/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"198705122010011004","password":"Guru#2026","role":"GURU"}' | head -1
# harap: HTTP/1.1 200, body {"ok":true,"role":"GURU"}, Set-Cookie sb-*
```
Verifikasi DB: `select identifier, role, must_change_password from public.users;` → 1 baris GURU.

---

### BATCH 5 — Shell UI guru + dashboard sesi + QR + realtime

**Task 5.1 — `src/app/globals.css`** — token `@theme` dari `docs/DESIGN.md`:
```css
@import "tailwindcss";
@theme {
  --color-kanvas: #F4F5F7;
  --color-kartu: #FFFFFF;
  --color-aksen: #8CE827;
  --color-aksen-hover: #7BE11D;
  --color-aksen-lembut: #ECFCCB;
  --color-teks: #111827;
  --color-teks-2: #6B7280;
  --color-garis: #EAECF0;
  --color-gelap: #0F172A;
  --color-hadir: #22C55E;
  --color-sakit: #A855F7;
  --color-izin: #F59E0B;
  --color-alpa: #EF4444;
  --radius-kartu: 1rem;
  --shadow-bento: 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06);
}
body { background: var(--color-kanvas); color: var(--color-teks); }
```
**Task 5.2 — `src/app/layout.tsx`** — Plus Jakarta Sans via `next/font`, `lang="id"`. **Tanpa** query DB (build mati di `/_not-found` kalau ada).
**Task 5.3 — `(guru)/layout.tsx`** + `Dock.tsx` + `TopBar.tsx` — persis render `absensi_dash2.png`: dock kiri ikon-only (logo, tombol gelap, kalender, grup, grafik, setelan, bantuan, logout), topbar pil + search + lonceng badge + avatar inisial.
**Task 5.4 — `POST /api/sesi/buka`** — body `{subjectId, classId}`. Validasi subject milik guru, kelas ada. `admin.from('sessions').insert(...)`. Konflik unique → 409 `{error:'sesi mapel ini sudah ada hari ini'}`. Return `{sessionId}`.
**Task 5.5 — `GET /api/qr?sessionId=`** — validasi sesi ACTIVE milik guru → `buatToken()` → `{token, expiresInMs}`. `Cache-Control: no-store`.
**Task 5.6 — `TampilanQR.tsx`** — client: `fetch('/api/qr')` saat mount, `setTimeout` rotasi saat `expiresInMs`, `QRCodeSVG` ukuran 240, progress bar aksen, teks `Token bergulir otomatis tiap 15 detik.`
**Task 5.7 — `useKehadiranLive.ts`** — `createBrowserClient` → `channel('sesi-'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'attendance_logs',filter:`session_id=eq.${id}`}, cb)`. Return `{logs, hadir, total}`.
**Task 5.8 — `KartuSesi.tsx` + `MetrikBento.tsx` + `TabelSiswaLive.tsx`** — counter `X / Y Siswa Hadir`, baris siswa berubah hijau saat realtime masuk, metrik 2x2 (Hadir/Sakit/Izin/Alpa).
**Task 5.9 — `GrafikTren.tsx`** — bar Sen–Jum dari `trenMingguan()`, satu batang hari ini aksen + tooltip hitam `34/36 Hadir`.
**Task 5.10 — `POST /api/sesi/tutup`** — 1 transaksi: `update sessions set status='CLOSED', ended_at=now()`; `insert ... select siswa kelas yang belum punya log dengan status 'ALPA'` (`on conflict do nothing`).
**Task 5.11 — `POST /api/sesi/manual`** — `{sessionId, studentId, status, notes}` upsert ke `HADIR_MANUAL`/`SAKIT`/`IZIN`.

**Gate 5:** `npx tsc --noEmit` exit 0; `npx next build` lolos; curl buka/tutup sesi; query DB membuktikan ALPA terisi:
```sql
select status, count(*) from public.attendance_logs where session_id='<id>' group by 1;
```

---

### BATCH 6 — Dashboard siswa + scanner QR + endpoint absen

**Task 6.1 — `(siswa)/layout.tsx` + `src/app/siswa/page.tsx`** — bento: header profil (inisial, nama, NISN, kelas, badge "Perangkat Terkunci (HP Ini)"), kartu sesi aktif, metrik pribadi 2x2, jadwal hari ini, 5 riwayat terakhir. `instant = false` + `await connection()`.
**Task 6.2 — `useSesiAktif.ts`** — subscribe `sessions` filter `class_id=eq.<kelas>` event `*`; saat ACTIVE → kartu menyala lime + tombol besar. Tanpa sesi → pesan tenang.
**Task 6.3 — `ScannerQR.tsx`** — `dynamic(() => import('html5-qrcode'))` client-only, `Html5Qrcode.getCameras()` → `facingMode: { ideal: 'environment' }`, frame sudut lime, `qrbox` 250, `fps: 10`. Hasil scan → `POST /api/absen` → popup sukses `Hadir — 07:14:02 WIB` + tutup kamera. Error → pesan jelas (token kedaluwarsa / sudah absen / sesi ditutup).
**Task 6.4 — `POST /api/absen`** — body `{token, deviceLockId, fingerprint}`. Alur: verifikasi HMAC → ambil sesi (harus ACTIVE & kelas siswa) → `periksaDevice` → insert log `HADIR`. Unique violation (23505) → 409 `{error:'sudah absen'}`. Return `{status:'HADIR', jam:'07:14:02'}`.
**Task 6.5 — Halaman `/siswa/scan`** (fallback URL penuh) supaya bisa diuji tanpa kamera lewat URL bertoken: `/siswa/scan?token=<token>` langsung submit.

**Gate 6:** `npm run uji` masih hijau; `npx next build` lolos; curl:
```bash
# buka sesi sebagai guru → ambil token
TOKEN=$(node scripts/ambil-token.cjs)   # cetak token + sessionId
curl -s -X POST localhost:3100/api/absen -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"deviceLockId\":\"11111111-1111-1111-1111-111111111111\",\"fingerprint\":\"abc\"}"
# harap: {"status":"HADIR","jam":"..."}
# ulang perintah sama → harap: 409 {"error":"sudah absen"}
```

---

### BATCH 7 — CRUD murid/kelas/mapel + import & ekspor Excel + reset device

**Task 7.1 — `POST /api/siswa`** — tambah murid manual: buat auth user (`identifier@siswa.absensi.local`, password = NISN, `email_confirm: true`) + insert `public.users`, rollback user auth kalau insert gagal.
**Task 7.2 — `PATCH/DELETE /api/siswa/[id]`** — hapus = `admin.auth.admin.deleteUser` (cascade ke `users`).
**Task 7.3 — `POST /api/siswa/import`** — `request.formData()` → `File` → `XLSX.read(buffer)` → validasi kolom `nisn|nama|kelas` (case-insensitive) → insert batch, laporkan `{dibuat, dilewati, gagal:[{baris, alasan}]}`. Template: `node scripts/buat-template-siswa.cjs`.
**Task 7.4 — `POST /api/reset-device`** — `{studentId}`. Guard: guru hanya siswa di kelas yang ia ampu (`schedules`/`sessions` miliknya). Set `device_lock_id=null, device_fingerprint=null`, tulis audit `RESET`.
**Task 7.5 — `/guru/murid`** — filter kelas, modal `+ Tambah Murid`, `UploadExcel`, tabel (NISN, nama, status kunci HP, Edit, Hapus, Reset Kunci HP dengan konfirmasi).
**Task 7.6 — `/guru/kelas` + `/guru/mapel`** — CRUD penuh. Mapel otomatis `teacher_id = auth.uid()`.
**Task 7.7 — `/guru/rekap`** — filter kelas + mapel + rentang tanggal; tabel rekap; tombol `Unduh Laporan Excel` → `GET /api/rekap/export?...`.
**Task 7.8 — `GET /api/rekap/export`** — `XLSX.utils.aoa_to_sheet` → `XLSX.write({type:'buffer', bookType:'xlsx'})` → `Response` dengan header `content-disposition: attachment; filename=rekap-<kelas>-<from>_<to>.xlsx`.

**Gate 7:** curl import file contoh → `{"dibuat":3,"dilewati":0,"gagal":[]}`; curl export → file `.xlsx` > 4 KB dan bisa dibuka `node -e "XLSX.readFile(...)"`.

---

### BATCH 8 — Data demo, hardening, dan verifikasi penuh

**Task 8.1 — `scripts/seed-demo.ts`** — 1 kelas `XII RPL 1` / `Rekayasa Perangkat Lunak`, 1 guru `198705122010011004`, 3 mapel (Pemrograman Web & Perangkat Bergerak, Basis Data, PPL), 5 jadwal Senin–Jumat, 36 siswa NISN `00612345xx`, password = NISN.
**Task 8.2 — `AGENTS.md`** — ditulis ulang memuat: stack, perintah, 6 aturan Next 16, aturan desain (rujuk `docs/DESIGN.md`), keamanan, jebakan host.
**Task 8.3 — Hardening** — rate limit `POST /api/absen` (maks 10/menit/IP, in-memory Map + TTL), `notes` maks 200 char, semua route handler validasi body dengan guard tipe manual, error tidak bocorkan stack.
**Task 8.4 — Lighthouse-ish layout audit** — Chromium via CDP: buka `/guru` di 1560px dan 420px, `document.documentElement.scrollWidth` vs `clientWidth` harus sama. Bukan cuma lihat screenshot.

**Gate 8 — Verifikasi wajib (semua harus hijau):**

| # | Perintah | Expected |
| :--- | :--- | :--- |
| 1 | `npm run uji` | semua test pass |
| 2 | `npx tsc --noEmit` | exit 0, 0 error |
| 3 | `npx next build` | sukses, muncul rute `/`, `/guru`, `/guru/murid`, `/guru/kelas`, `/guru/mapel`, `/guru/rekap`, `/siswa`, `/register-guru`, `/ganti-sandi` + semua `/api/*` |
| 4 | `npx next start -p 3100` | siap, `curl -si localhost:3100/ | head -1` → 200 |
| 5 | Login guru via curl | 200 + Set-Cookie |
| 6 | Buka sesi + `GET /api/qr` | `{token, expiresInMs}` valid; token sama 20 detik kemudian → **ditolak** 400 |
| 7 | Absen via curl | `HADIR` + jam detik; ulang → 409 |
| 8 | Tutup sesi | DB: sisa siswa = `ALPA`, jumlah log = jumlah siswa kelas |
| 9 | Device lock | login user sama dengan `deviceLockId` beda → 403 `MISMATCH` + 1 baris audit |
| 10 | Realtime | buka `/guru` + `/siswa` di 2 tab; scan → counter guru naik tanpa reload (bukti: `console.log` payload + screenshot) |
| 11 | Excel | import 3 baris → 3 user; export → file terbuka |
| 12 | Guard | `/guru` tanpa cookie → 307 ke `/`; login siswa lalu buka `/guru` → 307 ke `/siswa` |

---

## 6. Kode Inti (final, copy-paste)

### 6.1 `src/lib/qr.ts`

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const BUCKET_MS = 15_000

function sig(payload: string) {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET belum diset')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function buatToken(sessionId: string, now = Date.now()) {
  const bucket = Math.floor(now / BUCKET_MS)
  const payload = `${sessionId}.${bucket}`
  return { token: `${payload}.${sig(payload)}`, expiresInMs: BUCKET_MS - (now % BUCKET_MS) }
}

export function verifikasiToken(token: string, now = Date.now()) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [sessionId, bucketStr, tanda] = parts
  const bucket = Number(bucketStr)
  if (!sessionId || !Number.isInteger(bucket)) return null
  const sekarang = Math.floor(now / BUCKET_MS)
  if (bucket < sekarang - 1 || bucket > sekarang) return null
  const harap = Buffer.from(sig(`${sessionId}.${bucket}`))
  const kirim = Buffer.from(tanda)
  if (harap.length !== kirim.length || !timingSafeEqual(harap, kirim)) return null
  return { sessionId, bucket }
}
```

### 6.2 `src/lib/device.ts`

```ts
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function buatFingerprint(bahan: { userAgent: string; platform: string; layar: string; zona: string }) {
  return createHash('sha256')
    .update([bahan.userAgent, bahan.platform, bahan.layar, bahan.zona].join('|'))
    .digest('hex')
}

type Hasil = { hasil: 'OK' | 'LOCK' | 'MISMATCH' | 'TIDAK_ADA' }

export async function periksaDevice(
  admin: SupabaseClient,
  studentId: string,
  deviceLockId: string,
  fingerprint: string,
): Promise<Hasil> {
  const { data: user } = await admin
    .from('users')
    .select('device_lock_id, device_fingerprint')
    .eq('id', studentId)
    .single()
  if (!user) return { hasil: 'TIDAK_ADA' }

  if (!user.device_lock_id) {
    await admin.from('users').update({
      device_lock_id: deviceLockId,
      device_fingerprint: fingerprint,
      device_locked_at: new Date().toISOString(),
    }).eq('id', studentId)
    await admin.from('device_lock_audit').insert({
      student_id: studentId, action: 'LOCK', new_fingerprint: fingerprint,
    })
    return { hasil: 'LOCK' }
  }

  if (user.device_lock_id === deviceLockId && user.device_fingerprint === fingerprint) {
    return { hasil: 'OK' }
  }

  await admin.from('device_lock_audit').insert({
    student_id: studentId, action: 'MISMATCH',
    old_fingerprint: user.device_fingerprint, new_fingerprint: fingerprint,
  })
  return { hasil: 'MISMATCH' }
}
```

### 6.3 `src/lib/supabase/server.ts`

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createServerSupabase() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) jar.set(name, value, options)
          } catch {
            // Server Component: cookie read-only. Aman diabaikan; refresh ditangani proxy.
          }
        },
      },
    },
  )
}
```

`src/lib/supabase/admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

### 6.4 `src/proxy.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIK = ['/', '/register-guru']

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const jalur = request.nextUrl.pathname
  const publik = PUBLIK.includes(jalur)

  if (!user) return publik ? response : NextResponse.redirect(new URL('/', request.url))

  const { data: profil } = await supabase
    .from('users').select('role, must_change_password').eq('id', user.id).single()

  if (!profil) return NextResponse.redirect(new URL('/api/auth/logout', request.url))

  if (profil.must_change_password && jalur !== '/ganti-sandi') {
    return NextResponse.redirect(new URL('/ganti-sandi', request.url))
  }

  const rumah = profil.role === 'GURU' ? '/guru' : '/siswa'
  if (publik) return NextResponse.redirect(new URL(rumah, request.url))
  if (profil.role === 'GURU' && jalur.startsWith('/siswa')) {
    return NextResponse.redirect(new URL('/guru', request.url))
  }
  if (profil.role === 'SISWA' && jalur.startsWith('/guru')) {
    return NextResponse.redirect(new URL('/siswa', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
```

### 6.5 `POST /api/absen` (inti anti-titip absen)

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { verifikasiToken } from '@/lib/qr'
import { periksaDevice } from '@/lib/device'

export async function POST(request: Request) {
  const { token, deviceLockId, fingerprint } = await request.json()
  if (!token || !deviceLockId || !fingerprint) {
    return NextResponse.json({ error: 'data tidak lengkap' }, { status: 400 })
  }

  const tervalidasi = verifikasiToken(token)
  if (!tervalidasi) {
    return NextResponse.json({ error: 'QR kedaluwarsa, minta guru tampilkan ulang' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'belum login' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sesi } = await admin
    .from('sessions').select('id, class_id, status').eq('id', tervalidasi.sessionId).single()
  if (!sesi || sesi.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'sesi sudah ditutup' }, { status: 409 })
  }

  const { data: siswa } = await admin
    .from('users').select('id, class_id, role, is_active').eq('id', user.id).single()
  if (!siswa || siswa.role !== 'SISWA' || !siswa.is_active) {
    return NextResponse.json({ error: 'akun bukan siswa aktif' }, { status: 403 })
  }
  if (siswa.class_id !== sesi.class_id) {
    return NextResponse.json({ error: 'QR ini bukan untuk kelasmu' }, { status: 403 })
  }

  const device = await periksaDevice(admin, siswa.id, deviceLockId, fingerprint)
  if (device.hasil === 'MISMATCH') {
    return NextResponse.json({ error: 'perangkat berbeda, hubungi guru untuk reset kunci HP' }, { status: 403 })
  }

  const { error } = await admin.from('attendance_logs').insert({
    session_id: sesi.id, student_id: siswa.id, status: 'HADIR',
  })
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'kamu sudah absen di sesi ini' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: 'gagal menyimpan absensi' }, { status: 500 })

  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  }).format(new Date())

  return NextResponse.json({ status: 'HADIR', jam })
}
```

### 6.6 `POST /api/sesi/tutup` (auto-ALPA, satu panggilan)

```ts
const { data: sesi } = await admin.from('sessions')
  .select('id, class_id').eq('id', sessionId).eq('teacher_id', guru.id).single()
if (!sesi) return NextResponse.json({ error: 'sesi tidak ditemukan' }, { status: 404 })

const { data: semua } = await admin.from('users')
  .select('id').eq('class_id', sesi.class_id).eq('role', 'SISWA').eq('is_active', true)

const { data: sudah } = await admin.from('attendance_logs')
  .select('student_id').eq('session_id', sesi.id)

const sudahSet = new Set((sudah ?? []).map((r) => r.student_id))
const alpa = (semua ?? []).filter((s) => !sudahSet.has(s.id))
  .map((s) => ({ session_id: sesi.id, student_id: s.id, status: 'ALPA' as const }))

if (alpa.length) await admin.from('attendance_logs').insert(alpa)
await admin.from('sessions')
  .update({ status: 'CLOSED', ended_at: new Date().toISOString() }).eq('id', sesi.id)

return NextResponse.json({ ok: true, alpa: alpa.length })
```

### 6.7 `useKehadiranLive.ts`

```ts
'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useKehadiranLive(sessionId: string, awal: string[]) {
  const [hadir, setHadir] = useState<string[]>(awal)
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const kanal = supabase
      .channel(`sesi-${sessionId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const studentId = (payload.new as { student_id: string }).student_id
          setHadir((kini) => (kini.includes(studentId) ? kini : [...kini, studentId]))
        })
      .subscribe()
    return () => { supabase.removeChannel(kanal) }
  }, [sessionId])
  return hadir
}
```

---

## 7. Jebakan yang Sudah Diketahui (jangan diulang)

| Jebakan | Mitigasi |
| :--- | :--- |
| `export const dynamic` dilarang Next 16 | pakai `export const instant = false` di `page.tsx` |
| Query DB / `connection()` di `layout.tsx` → build mati di `/_not-found` | jangan taruh di root layout |
| Auth guard di layout → respons 200 + `<html id="__next_error__">` | guard di `src/proxy.ts` |
| `middleware.ts` deprecated | file harus `src/proxy.ts`, ekspor `proxy` |
| Policy RLS men-subquery tabelnya sendiri → infinite recursion | helper `security definer` (`saya_role`, `saya_kelas`) |
| `npm install` kena `ECONNRESET` | `--maxsockets=1` |
| `package-lock.json` gagal dibuat (`EALLOWREMOTE`) | jangan commit lock; `npm install` per mesin |
| `next start` lama tidak mati (`EADDRINUSE`) | ambil PID dari `netstat -ano | grep :3100`, kill PID itu (taskkill `/PID`) |
| Kamera laptop ini rusak (gambar hitam) | uji scan dari HP, atau `/siswa/scan?token=` langsung |
| Realtime diam | pastikan tabel masuk `supabase_realtime` + `replica identity full` + RLS select untuk `authenticated` |
| Zona waktu | semua hitung tanggal pakai `Asia/Jakarta` |
| Token QR tanpa secret | `QR_HMAC_SECRET` wajib ada, fail-fast saat start |

## 8. Risiko & Pertanyaan Terbuka

1. **Font `next/font` butuh jaringan saat build.** Kalau gagal, fallback `system-ui` sementara — jangan blokir build.
2. **Realtime di proyek Supabase free butuh RLS select policy yang benar.** Kalau payload tidak masuk, cek `pg_publication_tables` dulu, jangan langsung ganti arsitektur.
3. **Wewenang guru (keputusan #12)** memakai definisi "kelas yang ia ampu" = punya baris `schedules` atau `sessions` di kelas itu. Kalau nanti mau semua kelas sekolah bisa dikelola, cukup ubah helper `bolehKelolaKelas()`.
4. **Jumlah jam pelajaran per hari** belum didefinisikan PRD; jadwal demo mengisi 5 hari × 3 jam. Data riil diisi lewat `/guru/mapel` (atau seed).
5. **`must_change_password`** membuat login pertama selalu ke `/ganti-sandi`. Untuk demo cepat, `scripts/buat-akun.ts` punya flag `--tanpa-ganti`.

## 9. Urutan Eksekusi

Batch 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Setiap batch: implementasi, jalankan gate, laporkan hasil nyata (exit code + output), baru lanjut. Kalau gate merah, perbaiki dulu; jangan tumpuk batch berikutnya di atas fondasi rusak.
