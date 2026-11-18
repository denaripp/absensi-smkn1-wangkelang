# Sistem Absensi SMK Negeri 1 Wangkelang — Implementation Plan (Full Build, v1)

> **For Hermes:** eksekusi plan ini per batch (`kerjakan batch N`). Setiap batch wajib lolos gate verifikasi sebelum lanjut. Jangan lompati gate.

**Goal:** Membangun ulang 100% web absensi SMKN 1 Wangkelang dari nol — Next.js 16 App Router + Supabase (Postgres + Auth + Realtime) — dengan dua dashboard mandiri (Guru & Siswa), presensi Dynamic QR 15 detik, Device Lock 1 HP 1 akun, CRUD kelas/murid/mapel, import & ekspor Excel.

**Architecture:** Render server-first. Semua tulis ke DB lewat route handler dengan `SUPABASE_SERVICE_ROLE_KEY`; browser hanya baca dan dibatasi RLS. Autentikasi pakai Supabase Auth (`users.id` = FK `auth.users`), jadi RLS dan Realtime bisa pakai `auth.uid()`. Token QR = HMAC stateless (`sessionId.bucket.sig`, bucket 15 detik), tidak ada tulisan DB tiap rotasi. Guard role di `src/proxy.ts` (bukan layout). Realtime memakai Postgres Changes pada tabel `sessions` dan `attendance_logs` dengan filter kelas.

**Tech Stack:** Next.js 16.4.6 (App Router, Turbopack, `cacheComponents` + `partialPrefetching`), React 19.3.1, Tailwind CSS 4.3.5 (`@tailwindcss/postcss`), `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7, `qrcode.react` 4.2.0, `html5-qrcode` 2.3.8, `xlsx` 0.18.5, Font Awesome 7.3.1 (`@fortawesome/react-fontawesome` 3.5.0), plus `clsx` 2.1.1 + `tailwind-merge` 3.7.0, TypeScript 5.9.3, ESLint 9.39.5. Semua versi ini versi nyata di registry saat Batch 1 dieksekusi — rincian deviasi di Bagian 10.

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
    "@fortawesome/fontawesome-svg-core": "^7.3.1",
    "@fortawesome/free-solid-svg-icons": "^7.3.1",
    "@fortawesome/react-fontawesome": "^3.5.0",
    "@supabase/ssr": "^0.12.7",
    "@supabase/supabase-js": "^2.119.0",
    "clsx": "^2.1.1",
    "html5-qrcode": "^2.3.8",
    "next": "16.4.6",
    "qrcode.react": "^4.2.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "tailwind-merge": "^3.7.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.5",
    "@types/node": "^22.10.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "eslint": "^9.39.5",
    "eslint-config-next": "16.4.6",
    "tailwindcss": "^4.3.5",
    "typescript": "^5.9.3"
  }
}
```

- Run: `NODE_ENV=development npm install --include=dev --maxsockets=1` (mitigasi `ECONNRESET` **dan** `npm config get omit` = `dev` di mesin ini, yang membuat devDependencies dilewati tanpa `--include=dev`).
- Expected: `node_modules/` ada, `npm ls next` → `next@16.4.6`, `typescript@5.9.3`, `tailwindcss@4.3.5`, `eslint@9.39.5` terpasang.
- Catatan: `package-lock.json` **tidak terbentuk** di mesin ini (`EALLOWREMOTE`), jadi install mengulang dari `package.json` tiap mesin.

**Task 1.2 — Config files**

`next.config.ts` (bentuk final, sudah diverifikasi build):
```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true, partialPrefetching: true }
export default nextConfig
```
`experimental.cacheComponents` **deprecated** di 16.4.6. Melewatkan `partialPrefetching` memunculkan peringatan build "cacheComponents is enabled without a corresponding partialPrefetching option".

`postcss.config.mjs`:
```js
const konfigurasi = { plugins: { '@tailwindcss/postcss': {} } }
export default konfigurasi
```
(tanpa variabel perantara, ESLint memunculkan `import/no-anonymous-default-export`)

`eslint.config.mjs` — eslint-config-next 16 mengekspor **flat config array** langsung, jadi tanpa `FlatCompat` dan tanpa `@eslint/eslintrc`:
```js
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const konfigurasi = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**', 'tests/**'] },
  ...coreWebVitals,
  ...typescript,
]

export default konfigurasi
```

`tsconfig.json`: `paths: { "@/*": ["./src/*"] }`, `strict: true`, `exclude: ["node_modules", "scripts", "tests"]` (kalau tidak, `tsc` gagal `TS5097`). `next build` akan **menulis ulang** dua nilai ini sendiri: `jsx: preserve` → `react-jsx`, dan `include` += `.next/dev/types/**/*.ts`. Biarkan, jangan dilawan.

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
select count(*) from pg_policies where schemaname='public';                        -- 7 (rencana awal menulis 8; jumlah policy di Bagian 3 memang 7)
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
| `npm config get omit` = `dev` (mesin ini) | devDependencies dilewati tanpa error → `NODE_ENV=development npm install --include=dev` |
| `experimental.cacheComponents` deprecated di 16.4.6 | pakai top-level `cacheComponents: true` + `partialPrefetching: true` |
| `FlatCompat` + `next/core-web-vitals` (cara Next 14/15) | eslint-config-next 16 ekspor flat config array: `import coreWebVitals from 'eslint-config-next/core-web-vitals'` |
| `import/no-anonymous-default-export` pada config `.mjs` | simpan ke `const konfigurasi` lalu `export default konfigurasi` |

## 8. Risiko & Pertanyaan Terbuka

1. **Font `next/font` butuh jaringan saat build.** Kalau gagal, fallback `system-ui` sementara — jangan blokir build.
2. **Realtime di proyek Supabase free butuh RLS select policy yang benar.** Kalau payload tidak masuk, cek `pg_publication_tables` dulu, jangan langsung ganti arsitektur.
3. **Wewenang guru (keputusan #12)** memakai definisi "kelas yang ia ampu" = punya baris `schedules` atau `sessions` di kelas itu. Kalau nanti mau semua kelas sekolah bisa dikelola, cukup ubah helper `bolehKelolaKelas()`.
4. **Jumlah jam pelajaran per hari** belum didefinisikan PRD; jadwal demo mengisi 5 hari × 3 jam. Data riil diisi lewat `/guru/mapel` (atau seed).
5. **`must_change_password`** membuat login pertama selalu ke `/ganti-sandi`. Untuk demo cepat, `scripts/buat-akun.ts` punya flag `--tanpa-ganti`.

## 9. Urutan Eksekusi

Batch 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Setiap batch: implementasi, jalankan gate, laporkan hasil nyata (exit code + output), baru lanjut. Kalau gate merah, perbaiki dulu; jangan tumpuk batch berikutnya di atas fondasi rusak.

## 10. Catatan Eksekusi Batch 1 (18 Nov 2026)

Status: **selesai, gate hijau.** Commit `09055f3 chore: scaffold Next 16.4.6 + Tailwind 4 + config proyek (batch 1)`.

### 10.1 Versi terpasang (hasil `require('node_modules/<pkg>/package.json').version`)

| Paket | Versi nyata |
| :--- | :--- |
| next | 16.4.6 |
| react / react-dom | 19.3.1 |
| typescript | 5.9.3 |
| tailwindcss / @tailwindcss/postcss | 4.3.5 |
| eslint / eslint-config-next | 9.39.5 / 16.4.6 |
| @types/node / @types/react | 22.20.5 / 19.3.0 |
| @supabase/ssr / @supabase/supabase-js | 0.12.7 / 2.119.0 |
| qrcode.react / html5-qrcode / xlsx | 4.2.0 / 2.3.8 / 0.18.5 |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 |
| Font Awesome core + solid + react | 7.3.1 / 7.3.1 / 3.5.0 |

### 10.2 Deviasi dari rencana awal (semua karena plan menulis versi/API yang tidak sesuai registry)

1. Versi paket dikoreksi ke versi registry (react 19.3.0 → 19.3.1, tailwind 4.3.3 → 4.3.5, `@fortawesome/react-fontawesome` 3.2.0 → 3.5.0, tailwind-merge 2.5.4 → 3.7.0, typescript 5.7.2 → 5.9.3, eslint 9.17.0 → 9.39.5, `@types/react` 19.0.2 → 19.3.0).
2. `cacheComponents` dipindah ke top-level (di 16.4.6 `experimental.cacheComponents` deprecated) dan `partialPrefetching: true` ditambahkan agar build tanpa peringatan.
3. Install pertama hanya memasang 49 paket karena `npm config get omit` = `dev`; diulang dengan `NODE_ENV=development ... --include=dev` → 339 paket.
4. `eslint.config.mjs` memakai flat config bawaan `eslint-config-next` (tanpa `FlatCompat`, tanpa `@eslint/eslintrc`).
5. `tsconfig.json` ditulis ulang otomatis oleh `next build`: `jsx: react-jsx` dan `include` += `.next/dev/types/**/*.ts`.
6. `package-lock.json` tidak terbentuk (`EALLOWREMOTE`) — sesuai jebakan yang sudah tercatat.

### 10.3 Bukti gate

```
tsc --noEmit         → exit 0
eslint .             → exit 0 (0 error, 0 warning)
next build           → exit 0; "✓ Compiled successfully"; rute: ƒ / , ○ /_not-found
next start -p 3100   → GET / = 200 (body memuat "Sistem Absensi SMK Negeri 1 Wangkelang"), GET /halaman-tidak-ada = 404
npm ls next          → next@16.4.6
```

### 10.4 Env terpasang

`.env.local` berisi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anon), `SUPABASE_SERVICE_ROLE_KEY` (role `service_role`, ref `xlnrgtwqyzrwrchdczvf`, exp 2036-11-16), `SCHOOL_SECRET_CODE`, `QR_HMAC_SECRET` (64 char hasil `randomBytes(48).toString('base64url')`). File di-ignore git. Key belum diuji ke DB — pengujian nyata terjadi di Gate 2.

### 10.5 Yang sengaja belum dikerjakan

`AGENTS.md` (Task 8.2), `scripts/*` (Batch 2/8), `tests/*` (Batch 3), seluruh `src/app/api/*` dan `src/lib/*` (Batch 3 ke atas).

## 11. Catatan Eksekusi Batch 2 (18 Nov 2026)

Status: **selesai, gate hijau.** Migrasi `absensi_001_schema` + `absensi_002_rls` diterapkan ke project `xlnrgtwqyzrwrchdczvf`.

### 11.1 Bukti struktur DB (hasil `execute_sql`)

| Cek | Hasil |
| :--- | :--- |
| Tabel `public` | 7 |
| Tabel dengan RLS aktif | 7 |
| Policy total | 7 (`audit_baca, classes_baca, logs_baca, schedules_baca, sessions_baca, subjects_baca, users_baca`) |
| Policy INSERT/UPDATE/DELETE untuk `authenticated` | **0** |
| Tabel di publication `supabase_realtime` | `attendance_logs`, `sessions` |
| Fungsi helper | `saya_role`, `saya_kelas` (keduanya `prosecdef = true`) |
| Index | 23, termasuk `sessions_satu_aktif_per_kelas` (`UNIQUE ... WHERE status = 'ACTIVE'`) |
| Unique constraint | 6, termasuk `attendance_logs_session_id_student_id_key` dan `sessions_class_id_subject_id_session_date_key` |
| `users_id_fkey` | `confdeltype = c` (ON DELETE CASCADE ke `auth.users`) |
| Default `must_change_password` | `true` |
| `(now() at time zone 'Asia/Jakarta')::date` | `2026-11-18` |

### 11.2 Bukti `scripts/cek-koneksi.ts` (exit 0)

```
ADMIN BACA OK (0 baris)
ADMIN BACA attendance_logs OK (count=0)
ADMIN TULIS+HAPUS OK (roundtrip bersih)
ANON OK (0 baris, RLS menahan data)
ANON TULIS DITOLAK OK (42501)
```

Script menambah dua cek di luar rencana awal: roundtrip tulis+hapus sebagai admin (service role terbukti punya izin tulis) dan percobaan tulis sebagai anon yang **wajib gagal** (membuktikan RLS tidak bocor). Data uji dibersihkan pada run yang sama.

### 11.3 Deviasi dari rencana awal

1. **Jumlah policy = 7, bukan 8.** Bagian 3 plan memang hanya berisi 7 statement `create policy`; angka 8 di Gate 2 adalah salah hitung. Gate dikoreksi, bukan policy ditambah asal-asalan.
2. `002_rls.sql` menambah `revoke all ... from anon` + `grant execute ... to authenticated` pada kedua fungsi helper. Tanpa itu, fungsi helper masih bisa dipanggil anon walau policy-nya `to authenticated`.
3. `cek-koneksi.ts` memakai `main().catch(...)`, bukan top-level `await`, karena `package.json` tidak memakai `"type": "module"`. Node memunculkan peringatan `MODULE_TYPELESS_PACKAGE_JSON` (kosmetik, tidak memblokir).

### 11.4 Yang belum ada (memang jadwalnya nanti)

Belum ada data apa pun (0 kelas, 0 user, 0 sesi) — itu Batch 8 (`seed-demo.ts`). Belum ada endpoint maupun halaman yang memakai tabel ini (Batch 4 ke atas). Belum ada uji RLS dengan JWT siswa/guru sungguhan; uji itu butuh akun nyata dan terjadi di Gate 4/6.

## 12. Catatan Eksekusi Batch 3 (18 Nov 2026)

Status: **selesai, gate hijau.** 20 test lulus, `tsc` exit 0, `build` exit 0.

### 12.1 File yang dibuat

| File | Isi |
| :--- | :--- |
| `src/lib/qr.ts` | `BUCKET_MS = 15_000`, `buatToken`, `verifikasiToken` (HMAC sha256 base64url, toleransi 1 bucket) |
| `src/lib/device.ts` | `buatFingerprint` (sha256 64 hex), `periksaDevice` (LOCK / OK / MISMATCH / TIDAK_ADA + audit) |
| `src/lib/rekap.ts` | `hitungMetrik` (persen 1 desimal, nol pembagian aman), `trenMingguan` (urut Sen–Jum, Sabtu/Minggu dibuang) |
| `src/lib/supabase/server.ts` | SSR client berbasis cookie |
| `src/lib/supabase/browser.ts` | `createBrowserSupabase` (untuk realtime di client) |
| `src/lib/supabase/admin.ts` | service role, tanpa persist session |
| `src/lib/auth.ts` | `requireRole('GURU')` / `requireRole('SISWA')` → `{ profil, galat }`, 401/403 berupa `NextResponse` siap kirim |
| `tests/qr.test.ts` | 7 test |
| `tests/device.test.ts` | 6 test (fingerprint + `periksaDevice` dengan admin palsu) |
| `tests/rekap.test.ts` | 7 test |

### 12.2 Bukti gate

```
npm run uji    → # tests 20 | # pass 20 | # fail 0 | exit 0
tsc --noEmit   → exit 0
eslint .       → exit 0
next build     → exit 0, "✓ Compiled successfully", rute ƒ /
```

### 12.3 Deviasi dari rencana awal

1. **Jumlah test 20, bukan 9.** Plan hanya menyebut 4 test QR, 3 device, 5 rekap. Test ditambah pada jalur yang menyangkut keamanan (uuid beda walau fingerprint sama, token format ngawur, status absen tak dikenal) karena jalur itu yang menentukan bisa-tidaknya titip absen.
2. **`periksaDevice` diuji dengan admin palsu** (objek minimal `from().select().eq().single()`, `update().eq()`, `insert()`) — bukan Supabase sungguhan. Tujuannya menguji logika LOCK/OK/MISMATCH tanpa menyentuh DB. Uji ke DB nyata terjadi di Gate 4/6.
3. **Tanda tangan fungsi rekap berbeda dari plan.** Plan menulis `trenMingguan(logs, sesi)`; implementasi `trenMingguan(perHari: {tanggal, hadir, total}[])` — agregasi per tanggal dilakukan pemanggil (SQL `group by`), fungsi tetap murni dan mudah diuji.
4. **Bug di test pertama, bukan di kode.** Run pertama 19/20: asersi "toleransi 15 detik" memakai timestamp yang jatuh 10 detik di dalam bucket, sehingga +20 detik melompati dua bucket. Asersi diperbaiki memakai timestamp tepat di awal bucket. `verifikasiToken` tidak diubah.
5. `src/lib/auth.ts` memakai `NextResponse` sehingga hanya bisa dipakai di route handler, bukan Server Component. Guard halaman tetap di `src/proxy.ts` (Batch 4).

### 12.4 Yang belum ada

Belum ada route handler, `src/proxy.ts`, halaman, atau komponen. `requireRole` belum dipanggil di mana pun — pemakai pertamanya adalah Batch 4.

## 13. Catatan Eksekusi Batch 4 (18 Nov 2026)

Status: **selesai, gate hijau.** Auth end-to-end jalan di server produksi lokal `:3100`.

### 13.1 File yang dibuat

| File | Isi |
| :--- | :--- |
| `src/proxy.ts` | Guard role + `must_change_password`. Route `/api/**` **dilewati** (lihat deviasi 1). |
| `src/app/page.tsx` | Halaman masuk, `instant = false` + `await connection()`, tab Siswa/Guru |
| `src/components/FormMasuk.tsx` | Kirim `{identifier, password, role, deviceLockId, fingerprint}`; siswa menghitung identitas perangkat di browser |
| `src/lib/kunci.ts` | `ambilDeviceLockId()` (UUID localStorage) + `buatFingerprintBrowser()` (Web Crypto SHA-256, bahan sama dengan server) |
| `src/app/api/auth/login/route.ts` | Verifikasi password dulu → cek role → cek device (siswa) → set cookie sesi |
| `src/app/register-guru/page.tsx` + `components/FormDaftarGuru.tsx` | Pendaftaran guru + kode sekolah |
| `src/app/api/register-guru/route.ts` | `timingSafeEqual` kode sekolah, `admin.createUser`, insert profil, rollback bila insert gagal |
| `src/app/ganti-sandi/page.tsx` + `components/FormGantiSandi.tsx` | Ganti sandi + tombol keluar |
| `src/app/api/auth/ganti-sandi/route.ts` | `auth.updateUser({password})` → `must_change_password=false` |
| `src/app/api/auth/logout/route.ts` | `POST` (JSON) + `GET` (redirect, dipakai proxy) |

### 13.2 Bukti gate (curl nyata, `next start -p 3100`)

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 1 | Daftar guru, kode sekolah benar | `200 {"ok":true}` |
| 2 | Daftar guru, kode salah | `403 {"error":"kode sekolah salah"}` |
| 3 | Login guru | `200 {"ok":true,"role":"GURU","mustChangePassword":true}` + `set-cookie: sb-xlnrgtwqyzrwrchdczvf-auth-token=…` |
| 4 | `/guru` tanpa cookie | `307`, `location: /` |
| 5 | `/siswa` tanpa cookie | `307` |
| 6 | `/ganti-sandi` tanpa cookie | `307` |
| 7 | `/` dengan cookie, `must_change=true` | `307`, `location: /ganti-sandi` |
| 8 | `/guru` dengan cookie, `must_change=true` | `307`, `location: /ganti-sandi` |
| 9 | `/ganti-sandi` dengan cookie, `must_change=true` | `200` |
| 10 | `POST /api/auth/ganti-sandi` | `200 {"ok":true}` |
| 11 | Login dengan password **lama** setelah ganti | `401` (password benar-benar berubah) |
| 12 | `/ganti-sandi` setelah `must_change=false` | `307`, `location: /guru` |
| 13 | `/guru` dengan cookie guru sah | `404` (bukan `307` — artinya guard sudah meloloskan; halaman baru dibuat di Batch 5) |
| 14 | Logout `POST` | `200 {"ok":true}`, `/guru` kembali `307` |

Uji Device Lock (akun siswa sementara, kelas sementara, sudah dihapus lagi):

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 15 | Login HP pertama | `200` + `device_lock_id` tersimpan (`aaaaaaaa…`) |
| 16 | Login HP yang sama | `200` |
| 17 | Login dari HP lain | `403 {"error":"perangkat berbeda. Hubungi guru untuk reset kunci HP"}` |
| 18 | Login akun siswa dengan `role: GURU` | `403 {"error":"akun ini bukan akun GURU"}` |
| 19 | Login siswa tanpa identitas perangkat | `400` |
| 20 | Login password salah dari HP lain | `401`, dan audit **tidak** bertambah |

DB setelah uji: `users=1` (guru), `classes=0`, `device_lock_audit=0`, `auth.users=1`. Audit sempat tercatat `LOCK=1, MISMATCH=1` saat uji — angka itu jadi bukti, lalu ikut terhapus bersama akun uji (cascade).

Gate lokal: `npm run uji` 20/20 pass, `tsc` 0, `eslint` 0, `next build` sukses dengan rute `/`, `/ganti-sandi`, `/register-guru`, `/api/auth/{login,logout,ganti-sandi}`, `/api/register-guru`.

### 13.3 Deviasi dari rencana awal

1. **Proxy melewati `/api/**`.** Plan tidak menyebut ini. Tanpa pengecualian, `curl` ke `/api/auth/login` akan dibelokkan `307` sebelum route handler jalan, dan API tidak bisa mengembalikan JSON 401/403.
2. **Password diverifikasi sebelum cek device.** Plan menaruh cek device di langkah 3 dan login di langkah 4. Urutan itu berbahaya: orang lain bisa **mengunci HP siswa** hanya dengan menebak NISN tanpa tahu password. Sekarang: `signInWithPassword` dulu → device. Kalau device mismatch, sesi langsung `signOut()`.
3. **Email auth diambil dari `admin.auth.admin.getUserById`, bukan ditebak** dari pola `identifier@siswa.absensi.local`. Pola tebakan gagal untuk akun guru yang memakai email asli.
4. **Navigasi klien pakai `next/link` dan `useRouter().replace()`**, bukan `<a>` / `window.location.href`. `eslint .` menolak bentuk pertama (2 error + 2 warning).
5. **`/ganti-sandi` tidak memakai `instant = false`** karena tidak membaca cookie/DB sendiri; guard-nya tetap di proxy.
6. Halaman `/guru` dan `/siswa` belum ada, jadi hasil uji guard yang benar adalah `404` setelah lolos, bukan `200`.

### 13.4 Kondisi data saat ini

Satu akun guru aktif: `identifier=198705122010011004`, `role=GURU`, `must_change_password=false`, sandi saat ini `GuruBaru#2026` (hasil uji ganti sandi). Belum ada kelas, siswa, mapel, atau sesi.

## 14. Catatan Eksekusi Batch 5 (18 Nov 2026)

Status: **selesai, gate hijau.** Dashboard guru jalan dengan data nyata dari DB, QR HMAC aktif, auto-Alpa terbukti.

### 14.1 File yang dibuat

| File | Isi |
| :--- | :--- |
| `src/app/globals.css` | Token `@theme` lengkap dari `docs/DESIGN.md` + kelas `.tabular` |
| `src/app/layout.tsx` | Plus Jakarta Sans via `next/font/google`, `lang="id"`, tanpa query DB |
| `src/app/(guru)/layout.tsx` | Shell di dalam `<Suspense>` supaya profil dinamis tidak memblokir prerender |
| `src/components/ShellGuru.tsx` | Ambil profil guru (nama, NIP) lalu render Dock + TopBar + konten |
| `src/components/Dock.tsx` | Rail ikon: Dashboard aktif, 4 menu lain `aria-disabled` + `title` (Batch 7), tombol keluar |
| `src/components/TopBar.tsx` | Pil menu, kolom cari (disabled + alasan di `title`), lonceng, avatar inisial, tanggal WIB |
| `src/components/PanelSesi.tsx` | Gabungan Kartu Sesi + QR + metrik 2x2 + tabel siswa live + aksi tutup/manual |
| `src/components/GrafikTren.tsx` | Batang Sen–Jum, satu batang highlight + tooltip hitam, state kosong jujur |
| `src/components/KartuIdentitasGuru.tsx` | Kartu gelap `#0F172A` berisi NIP, nama, jurusan, jumlah mapel |
| `src/components/AksiTombol.tsx` | Tombol tanpa backend tetap bisa diklik, memunculkan alasan |
| `src/hooks/useKehadiranLive.ts` | Langganan `postgres_changes` pada `attendance_logs` + delta state |
| `src/lib/format.ts` | `jamWIB`, `tanggalPanjangWIB`, `tanggalWIB`, `sapaanWIB`, `tanggalTujuhHariLaluWIB` |
| `src/app/(guru)/guru/page.tsx` | Dashboard: greeting, sesi aktif, roster, metrik, tren 7 hari, ringkasan rekap |
| `src/app/api/sesi/buka/route.ts` | Validasi mapel milik guru + kelas ada, insert sesi, 409 untuk sesi ganda |
| `src/app/api/qr/route.ts` | Token HMAC + `cache-control: no-store`, sesi harus ACTIVE milik guru |
| `src/app/api/sesi/tutup/route.ts` | Auto-Alpa semua siswa aktif tanpa log, lalu `status=CLOSED` |
| `src/app/api/sesi/manual/route.ts` | Upsert `HADIR_MANUAL` / `SAKIT` / `IZIN`, notes maks 200 char, validasi kelas |

### 14.2 Bukti gate (curl + query, server `:3100`)

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 1 | Login guru | `200` |
| 2 | `GET /guru` | `200`, 40.289 byte, memuat `Pemrograman Web`, `Munculkan QR Code`, `XII RPL 1` |
| 3 | `POST /api/sesi/buka` | `200 {"sessionId":"2d2e25ad-…"}` |
| 4 | Buka sesi lagi (kelas sama) | `409` (constraint `sessions_satu_aktif_per_kelas`) |
| 5 | `GET /api/qr` | `{"token":"2d2e25ad-….119667515.7nWhV…","expiresInMs":10735}` + `cache-control: no-store` |
| 6 | `GET /guru` saat sesi aktif | `200`, memuat `Sesi Aktif`, `Scan via HP Siswa`, `Tutup Sesi`, `Ahmad Fauzi`, `0/5 sudah absen` |
| 7 | `POST /api/sesi/manual` (SAKIT) | `200 {"ok":true,"status":"SAKIT"}` |
| 8 | `POST /api/sesi/tutup` | `200 {"ok":true,"alpa":4,"totalSiswa":5}` |
| 9 | Tutup sesi lagi | `409` |
| 10 | `GET /guru` setelah tutup | `200`, `Belum ada sesi aktif` muncul, tombol `Munculkan QR Code` kembali |
| 11 | `POST /api/sesi/buka` tanpa login | `401` |
| 12 | `GET /api/qr` tanpa login | `401` |

DB: `sessions=1` (CLOSED), `attendance_logs=5` → `ALPA=4`, `SAKIT=1`. Jumlah log = jumlah siswa, tidak ada yang tertinggal.

Gate lokal: `npm run uji` 20/20, `tsc` 0, `eslint` 0, `next build` sukses. Rute baru: `/guru` (partial prerender), `/api/qr`, `/api/sesi/{buka,tutup,manual}`.

### 14.3 Deviasi dari rencana awal

1. **Komponen digabung.** Plan memisah `KartuSesi`, `TampilanQR`, `MetrikBento`, `TabelSiswaLive`. Semua digabung ke `PanelSesi.tsx` karena berbagi satu state (token QR, siklus rotasi, peta status live, aksi). Memisahnya justru menambah prop-drilling tanpa manfaat.
2. **`useKehadiranLive` memakai pola render-phase reset**, bukan `setState` di badan effect. Aturan `react-hooks/set-state-in-effect` menolak bentuk pertama (error lint).
3. **`Date.now()` dipindah ke helper** `tanggalTujuhHariLaluWIB()` di `src/lib/format.ts`. Aturan `react-hooks/purity` menolak pemanggilan impure langsung di badan komponen.
4. **Shell guru dibungkus `<Suspense>`.** Layout membaca cookie/profil (dinamis), sehingga tanpa Suspense build gagal pada prerender `cacheComponents`.
5. **Menu yang belum ada dirender `aria-disabled` + `title`**, dan kolom pencarian `disabled` dengan alasan di `title` — sesuai aturan UI proyek, bukan tombol mati tanpa keterangan.
6. **Realtime belum diuji end-to-end.** Hook terpasang dan halaman tersubscribe, tapi bukti payload masuk butuh dua tab browser + akun siswa; itu dijadwalkan di Gate 6/8.

### 14.4 Data yang ditinggalkan (bukan sampah, dipakai batch berikut)

1 kelas `XII RPL 1` (Rekayasa Perangkat Lunak), 1 mapel `Pemrograman Web & Perangkat Bergerak`, 1 jadwal (Selasa jam ke-3, 07:30–09:00), 5 siswa `0061234501`–`0061234505` (sandi = NISN, `must_change_password=false`), 1 sesi CLOSED berisi 1 SAKIT + 4 ALPA. Skrip penyiapnya dihapus setelah dipakai; `scripts/` kini hanya berisi `cek-koneksi.ts`.

## 15. Catatan Eksekusi Batch 6 (18 Nov 2026)

Status: **selesai, gate hijau.** Siswa bisa masuk, melihat sesi aktif, memindai QR, dan absensi tercatat `HADIR` dengan device lock aktif.

### 15.1 File yang dibuat

| File | Isi |
| :--- | :--- |
| `src/app/(siswa)/layout.tsx` | Ambil profil + kelas + status kunci perangkat, lalu render shell |
| `src/components/ShellSiswa.tsx` | Header profil (inisial, nama, NISN, kelas), badge "Perangkat Terkunci (HP Ini)", tombol keluar |
| `src/app/(siswa)/siswa/page.tsx` | Bento siswa: sesi aktif, metrik pribadi 2x2, jadwal hari ini, 5 riwayat terakhir |
| `src/components/PanelSesiSiswa.tsx` | Kartu sesi aktif hijau lime + tombol "Buka Kamera & Scan QR", atau pesan tenang saat kosong |
| `src/components/ScannerQR.tsx` | Modal kamera `html5-qrcode` (`facingMode: environment`, `qrbox 250`, `fps 10`), kirim token ke server, popup `Hadir — HH:mm:ss WIB` |
| `src/components/AbsenDariToken.tsx` | Jalur cadangan `?token=` untuk HP yang kameranya bermasalah |
| `src/app/(siswa)/siswa/scan/page.tsx` | Halaman `/siswa/scan?token=…` |
| `src/hooks/useSesiAktif.ts` | Langganan `postgres_changes` tabel `sessions` per kelas → `router.refresh()` |
| `src/app/api/absen/route.ts` | Verifikasi HMAC → sesi ACTIVE → siswa sekelas → device lock → insert `HADIR` (409 duplikat) |
| `src/lib/format.ts` | Tambah `hariKeWIB()`; `jamWIB()` pindah ke locale `en-GB` |

### 15.2 Bukti gate (curl + query, server `:3100`)

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 1 | Login guru | `{"ok":true,"role":"GURU"}` |
| 2 | Buka sesi mapel lain di hari yang sama | `200 {"sessionId":"ac098a4d-…"}` (bukti constraint per-mapel, bukan per-kelas saja) |
| 3 | `GET /api/qr` | token `ac098a4d-….…` |
| 4 | Login siswa `0061234501` HP pertama | `200 {"ok":true,"role":"SISWA"}`, device terkunci |
| 5 | `POST /api/absen` token valid | `200 {"status":"HADIR","jam":"21:45:10"}` |
| 6 | Absen ulang | `409 {"error":"kamu sudah absen di sesi ini"}` |
| 7 | Absen dari HP berbeda | `403 {"error":"perangkat berbeda. Hubungi guru untuk reset kunci HP"}` |
| 8 | Token didiamkan 33 detik lalu dipakai | `400 {"error":"QR kedaluwarsa, minta guru tampilkan ulang"}` |
| 9 | `GET /siswa` | `200`, 23.278 byte, memuat `Sesi Aktif`, `Basis Data`, `Rahmat`, `Hadir`, `Jadwal Hari Ini`, `Riwayat Presensi Terakhir`, `Perangkat Terkunci`, `0061234501`, `XII RPL 1` |
| 10 | `GET /siswa/scan?token=…` | `200`, memuat `Presensi via Tautan Token` |
| 11 | Siswa membuka `/guru` | `307`, `location: /siswa` |
| 12 | `POST /api/sesi/tutup` | `{"ok":true,"alpa":4,"totalSiswa":5}` |

DB sesi `ac098a4d-…`: `HADIR=1`, `ALPA=4` — jumlah log = 5 = jumlah siswa.

Gate lokal: `npm run uji` 20/20, `tsc` 0, `eslint` 0, `next build` sukses. Rute baru: `/siswa` (ƒ), `/siswa/scan` (ƒ), `/api/absen` (ƒ).

### 15.3 Deviasi dari rencana awal

1. **`jamWIB` pindah ke locale `en-GB`.** Uji nyata mengembalikan `21.45.10` (id-ID memakai titik), padahal PRD minta `07:14:02`. Diperbaiki, bukan dibiarkan.
2. **Nama guru dibaca lewat admin client di server.** Policy `users_baca` hanya mengizinkan siswa membaca barisnya sendiri, jadi join nama guru mustahil dari browser. Query tetap di server, tidak ada key yang bocor ke client.
3. **`useSesiAktif` hanya memicu `router.refresh()`**, tidak menyimpan state sesi di client. Server tetap sumber kebenaran; realtime cuma pemicu render ulang.
4. **`ScannerQR` mendefinisikan fungsi kirim di dalam `useEffect`** agar `react-hooks/exhaustive-deps` bersih; tidak ada `eslint-disable`.
5. **`/siswa` sepenuhnya dinamis (ƒ)**, bukan partial prerender, karena layout membaca cookie lalu langsung merender data.
6. **Uji butuh mapel kedua.** Constraint unik `(class_id, subject_id, session_date)` menolak sesi mapel yang sama di hari yang sama, jadi dibuat mapel `Basis Data` untuk menguji ulang alur penuh.

### 15.4 Yang belum dibuktikan

1. **Realtime belum diuji end-to-end.** Hook siswa dan guru terpasang dan halaman tersubscribe, tapi bukti payload masuk butuh dua tab browser dengan dua akun. Dijadwalkan di Gate 8.
2. **Kamera belum diuji di perangkat nyata.** Kamera laptop ini rusak (gambar hitam), jadi jalur `html5-qrcode` baru diverifikasi secara build + alur API. Uji visual kamera harus dari HP.
3. **Rate limit `POST /api/absen` belum ada** — dijadwalkan di Batch 8.

### 15.5 Kondisi data

2 mapel (`Pemrograman Web & Perangkat Bergerak`, `Basis Data`), 5 siswa, 1 kelas, 1 jadwal, 2 sesi CLOSED. Log: sesi pertama 1 SAKIT + 4 ALPA; sesi kedua 1 HADIR + 4 ALPA. Siswa `0061234501` perangkatnya terkunci ke `aaaaaaaa-1111-4111-8111-111111111111`; siswa `0061234502` terkunci ke `bbbbbbbb-2222-4222-8222-222222222222` (dipakai untuk uji token kedaluwarsa).

## 16. Catatan Eksekusi Batch 7 (18 Nov 2026)

Status: **selesai, gate hijau.** CRUD kelas/mapel/murid, import Excel, reset kunci HP, dan ekspor rekap semuanya jalan dengan data nyata.

### 16.1 File yang dibuat

| File | Isi |
| :--- | :--- |
| `src/lib/otoritas.ts` | `kelasDiampu()` (jadwal + sesi guru), `bolehKelolaKelas()` |
| `src/app/api/siswa/route.ts` | Tambah murid: buat akun auth (`nisn@siswa.absensi.local`, sandi = NISN) + rollback bila profil gagal |
| `src/app/api/siswa/[id]/route.ts` | `PATCH` nama/kelas, `DELETE` via `auth.admin.deleteUser` (cascade) |
| `src/app/api/siswa/import/route.ts` | Baca `.xlsx` (maks 2 MB), validasi kolom `nisn`/`nama`/`kelas`, laporkan `{dibuat, dilewati, gagal[]}` |
| `src/app/api/reset-device/route.ts` | Kosongkan `device_lock_id` + `device_fingerprint`, tulis audit `RESET` dengan `actor_id` |
| `src/app/api/kelas/route.ts` + `kelas/[id]/route.ts` | Tambah/ubah/hapus kelas; hapus ditolak `409` bila masih ada siswa |
| `src/app/api/mapel/route.ts` + `mapel/[id]/route.ts` | Tambah/ubah/hapus mapel milik guru; hapus ditolak `409` bila sudah dipakai sesi |
| `src/app/api/rekap/export/route.ts` | `.xlsx` dari sesi + log pada rentang tanggal, header `content-disposition` |
| `src/app/(guru)/guru/{murid,kelas,mapel,rekap}/page.tsx` | 4 halaman pengelolaan |
| `src/components/Panel{Murid,Kelas,Mapel,Rekap}.tsx` | Form + tabel + aksi, semua memanggil route handler |
| `src/components/Dock.tsx` | 5 menu aktif (tidak ada lagi `aria-disabled`) |
| `scripts/buat-template-siswa.cjs` | Generator `template-siswa.xlsx` (3 kolom + 2 baris contoh) |

### 16.2 Bukti gate (curl nyata, server `:3100`)

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 1 | Impor `.xlsx` 4 baris (3 valid + 1 kelas salah) | `{"dibuat":3,"dilewati":0,"gagal":[{"baris":5,"alasan":"kelas \"KELAS TIDAK ADA\" tidak ada"}]}` |
| 2 | `GET /guru/murid` | `200`, 35.990 byte, memuat nama hasil impor |
| 3 | Tambah murid manual | `{"ok":true,"id":"a53931e5-…"}` |
| 4 | Tambah murid ke kelas yang tidak diampu | `403 {"error":"kamu tidak mengampu kelas ini"}` |
| 5 | Ekspor rekap 1–30 Nov | 19.738 byte, `content-disposition: attachment; filename="rekap-XII-RPL-1-2026-11-01_2026-11-30.xlsx"`, MIME xlsx |
| 6 | Baca ulang file ekspor | sheet `Rekap Absensi`, 11 baris, header `No, Tanggal, Jam Scan, NISN, Nama Siswa, Mata Pelajaran, Status, Catatan`, contoh baris `1 | 2026-11-18 | 21:38:50 | 0061234502 | Siti Nurhaliza | Pemrograman Web & Perangkat Bergerak | SAKIT | surat dokter` |
| 7 | Reset kunci HP `0061234501` | `{"ok":true}` → DB `device=null`, audit `RESET=1` |
| 8 | Rename + hapus kelas uji | `{"ok":true}` dua-duanya |
| 9 | Tambah + rename + hapus mapel uji | `{"ok":true}` tiga-tiganya |
| 10 | Hapus murid manual | `{"ok":true}` |

DB setelah uji: 8 siswa (`0061234501`–`0061234505` + `0061234520`–`0061234522`), 1 kelas `XII RPL 1`, 2 mapel, audit `RESET=1, MISMATCH=1, LOCK=2`.

Gate lokal: `npm run uji` 20/20, `tsc` 0, `eslint` 0, `next build` sukses. Rute baru: `/guru/{murid,kelas,mapel,rekap}` (partial prerender) + 9 route handler `/api/{siswa,kelas,mapel,reset-device,rekap/export}`.

### 16.3 Deviasi dari rencana awal

1. **`EXCEL` impor memakai header fleksibel.** Selain `nisn`/`nama`/`kelas`, diterima juga `nis` dan `nama lengkap`, dan pencocokan nama kelas tidak peduli huruf besar/kecil. Tanpa ini file buatan sekolah (yang sering berheader beda) akan gagal semua.
2. **Hapus kelas/mapel ditolak `409`, bukan dibiarkan gagal FK.** Pesannya menyebut jumlah siswa/sesi yang menghalangi, supaya guru tahu harus apa.
3. **Ekspor memakai `admin` client** karena join nama siswa/mapel lintas tabel tidak terjamin lewat RLS guru; otorisasi tetap dicek lebih dulu dengan `bolehKelolaKelas`.
4. **Dock disederhanakan**: logika `aria-disabled` dihapus karena kelima rute kini ada.
5. **`template-siswa.xlsx` tidak di-commit** — dibuat ulang kapan saja lewat `node scripts/buat-template-siswa.cjs`.
6. **`hariIniLabel()` ditambahkan** ke `src/lib/format.ts` (alias `tanggalPanjangWIB`) untuk header halaman rekap.

### 16.4 Yang belum dibuktikan

1. Rate limit seluruh endpoint mutasi dan `POST /api/absen` — Batch 8.
2. Realtime guru/siswa dua tab — Batch 8.
3. Uji kamera di perangkat nyata — tetap tidak bisa dari laptop ini.

## 17. Catatan Eksekusi Batch 8 (18 Nov 2026)

Status: **selesai, gate hijau.** Data demo 36 siswa masuk, rate limit aktif, realtime terbukti, audit layout desktop & HP bersih.

### 17.1 File yang dibuat / diubah

| File | Isi |
| :--- | :--- |
| `scripts/seed-demo.ts` | Seed idempoten: kelas, guru, 3 mapel, 5 jadwal, 36 siswa (upsert per NISN, nama dinormalkan) |
| `src/lib/limit.ts` | `batasi()` (Map + TTL), `ipDari()`, `kosongkanBatas()`; `shortcut:` per-instance, bukan Redis |
| `tests/limit.test.ts` | 4 test: batas, kunci terpisah, pemulihan jendela, `tungguDetik` |
| `src/app/api/absen/route.ts` | Rate limit 10/menit/IP → `429` + `retry-after` |
| `src/app/api/auth/login/route.ts` | Rate limit 10/menit/IP (di luar rencana awal) |
| `AGENTS.md` | Ditulis ulang: stack, perintah, 8 aturan Next 16, peta rute, keamanan, data demo, jebakan host |

### 17.2 Hasil seed

```
{"kelas":"XII RPL 1","siswaBaru":28,"siswaDiperbarui":8,"totalSiswa":36,"totalMapel":3,"totalJadwal":6}
```

Sesudah pembersihan satu jadwal sisa Batch 5 (Selasa jam ke-3): 5 jadwal Senin–Jumat jam ke-1, 07:00–08:30. Siswa `0061234520`–`0061234522` (sisa uji impor Batch 7) ikut dinormalkan namanya jadi bagian 36 siswa.

### 17.3 Bukti Gate 8

| # | Uji | Hasil |
| :--- | :--- | :--- |
| 1 | `npm run uji` | `# tests 24`, `# pass 24`, `# fail 0` |
| 2 | `tsc --noEmit` | exit 0 |
| 3 | `next build` | sukses, 29 rute: `/`, `/ganti-sandi`, `/register-guru`, `/guru`, `/guru/{kelas,mapel,murid,rekap}`, `/siswa`, `/siswa/scan`, 19 route handler `/api/**` |
| 4 | `GET /` | `200` |
| 5 | Login guru | `200 {"ok":true,"role":"GURU","mustChangePassword":false}` |
| 6 | Buka sesi + `GET /api/qr` | `{"sessionId":"b053d27c-…"}` + token `b053d27c-….119667595.ArbUG4…` (`expiresInMs` 9.851) |
| 7 | Absen ulang | `409 {"error":"kamu sudah absen di sesi ini"}` |
| 8 | Tutup sesi | `{"ok":true,"alpa":35,"totalSiswa":36}` — 1 HADIR + 35 ALPA |
| 9 | Device mismatch | `403 {"error":"perangkat berbeda. Hubungi guru untuk reset kunci HP"}` |
| 10 | **Realtime** | channel `SUBSCRIBED`, absen `200 {"status":"HADIR","jam":"21:59:57"}`, payload diterima: `{"student_id":"0a7a01b0-…","status":"HADIR","session_id":"b053d27c-…"}` |
| 11 | Ekspor Excel | `200`, 31.565 byte, sheet `Rekap Absensi`, 47 baris, header utuh, baris contoh: No 1, `2026-11-18`, `21:38:50`, `0061234502`, Siti Nurhaliza, Pemrograman Web & Perangkat Bergerak, `SAKIT`, `surat dokter` |
| 12 | Guard | `/guru` tanpa cookie → `307 /`; siswa → `/guru` `307 /siswa` |
| + | Rate limit `POST /api/absen` | percobaan 1–10 → `400`, percobaan ke-11 → **`429`** |

Audit layout via Chromium CDP (`scrollWidth` vs `clientWidth`, harus sama):

| Halaman | 1560px | 420px |
| :--- | :--- | :--- |
| `/guru` | `sw=1560 cw=1560` ✅ (judul "Selamat Malam, Rahmat", 5 kartu) | `sw=420 cw=420` ✅ |
| `/siswa` | `sw=1545 cw=1545` ✅ ("Sandi Pratama", badge "Perangkat Terkunci" ada, 4 kartu) | `sw=420 cw=420` ✅ |

### 17.4 Deviasi dari rencana awal

1. **Rate limit juga dipasang di `/api/auth/login`**, bukan hanya `/api/absen`. Tanpa itu tebak-sandi NISN tidak dibatasi sama sekali.
2. **Limiter berbasis memori per-instance.** Ditandai `shortcut:` di `src/lib/limit.ts`; kalau nanti jalan di beberapa instance, pindahkan ke tabel/Redis.
3. **Seed menyetel `must_change_password=false`** untuk siswa demo supaya bisa langsung dipakai uji; guru tetap `false` karena sudah pernah ganti sandi.
4. **Satu jadwal sisa Batch 5 dihapus** (Selasa jam ke-3) agar sesuai rencana 5 jadwal.
5. **Uji realtime memakai skrip Node** (`supabase-js` + JWT guru), bukan dua tab browser: cookie browser dipakai bersama antar tab, jadi guru dan siswa tidak bisa login bersamaan di satu profil. Skrip memakai jalur yang sama (channel `postgres_changes`, RLS, publikasi) lalu memicu absen lewat HTTP.
6. **Audit `/siswa` memakai siswa `0061234535`** (belum terkunci) karena login dari Chromium akan mengunci perangkat; siswa `0061234534` sebelumnya sudah terkunci ke `cccccccc…`.
7. **Cookie jar curl sempat basi** saat uji ekspor (`{"error":"belum login"}`); login ulang dengan jar baru → `200` dan file valid. Tidak ada perubahan kode.

### 17.5 Yang tetap belum bisa dibuktikan di mesin ini

1. **Kamera asli** — hardware laptop rusak; jalur `html5-qrcode` hanya terbukti lewat build + alur API + fallback `/siswa/scan?token=`.
2. **Rate limit terdistribusi** — perlu store bersama kalau deploy multi-instance.
3. **Audit log untuk CRUD kelas/mapel** — belum ada; hanya device lock yang ber-audit.

## 18. Perbaikan: `unstable value Date.now()` di `/siswa` (18 Nov 2026)

Gejala dari `npm run dev`:

```
## Error Type
Blocking Route
Route "/siswa": Next.js encountered the unstable value `Date.now()` while prerendering.
    at LayoutSiswa
```

Halaman **tetap membalas `200`** dan isinya benar (`Jadwal Hari Ini`, `Metrik Kehadiranmu` ada). Jadi bug ini tidak pernah terlihat oleh `curl -o /dev/null -w %{http_code}` — hanya muncul sebagai overlay browser dan satu baris `ERROR` di `.next/dev/logs/next-development.log` per request yang memicu prerender ulang.

### 18.1 Penyebab sebenarnya (dibuktikan A/B di `next start`, bukan dugaan)

Komponen async pembaca cookie/DB di layout (`ShellGuru`, `IsiSiswa`) tidak pernah menyatakan diri request-time. `cacheComponents` tetap menjalankan satu pass prerender; di dalamnya `@supabase/auth-js` memanggil `Date.now()` untuk validasi token → Next mencatat error. `<Suspense>` saja tidak cukup: layout siswa sudah di-Suspense dan error tetap muncul tiap request.

### 18.2 Bukti A/B (prod `next start`, hitung `grep -c "unstable value"` di log)

| Varian | Hasil |
| :--- | :--- |
| Sebelum perbaikan, 4 request (`/siswa` 2×, `/guru` 2×) | 4 error, halaman tetap `200` |
| Proxy dimatikan lewat flag uji (`/siswa` 2×) | 2 error → bukan proxy |
| `hariKeWIB()` dijadikan konstanta `3` | error tetap → bukan helper waktu |
| Setelah `await connection()` di `ShellGuru` + `IsiSiswa` | `/siswa` 2×, `/guru` 2×, `/guru/murid` 1× → **0 error**, semua `200` |
| `next dev` setelah perbaikan (`/siswa`, `/guru`) | **0 error** |

### 18.3 Perbaikan final

1. `src/components/ShellGuru.tsx`: `await connection()` sebagai baris pertama.
2. `src/app/(siswa)/layout.tsx`: dipecah jadi `IsiSiswa` async + `<Suspense>`, dan `IsiSiswa` diawali `await connection()`.

### 18.4 Aturan untuk agent berikutnya

Setiap komponen async yang membaca cookie/DB di dalam layout **wajib** `await connection()` di baris pertama **dan** dibungkus `<Suspense>` di layout-nya. Bukti verifikasi = `grep -c "unstable value"` di log server (`0`), bukan status HTTP, karena halaman tetap `200` walau error tercatat.
