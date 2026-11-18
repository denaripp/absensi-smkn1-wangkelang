-- Migrasi: absensi_001_schema (diterapkan 2026-11-18 ke project xlnrgtwqyzrwrchdczvf)
create extension if not exists pgcrypto;

-- ============ CLASSES ============
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  class_name  varchar(64)  not null unique,
  major       varchar(96)  not null,
  grade       varchar(4)   not null check (grade in ('X','XI','XII')),
  created_at  timestamptz  not null default now()
);

-- ============ USERS (id = auth.users.id) ============
create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  identifier            varchar(64)  not null unique,
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
alter table public.sessions        replica identity full;
alter table public.attendance_logs replica identity full;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.attendance_logs;
