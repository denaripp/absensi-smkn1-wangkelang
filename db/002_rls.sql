-- Migrasi: absensi_002_rls (diterapkan 2026-11-18 ke project xlnrgtwqyzrwrchdczvf)
alter table public.classes            enable row level security;
alter table public.users              enable row level security;
alter table public.teacher_subjects   enable row level security;
alter table public.schedules          enable row level security;
alter table public.sessions           enable row level security;
alter table public.attendance_logs    enable row level security;
alter table public.device_lock_audit  enable row level security;

-- Helper security definer: mencegah infinite recursion saat policy membaca public.users
create or replace function public.saya_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.saya_kelas()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.users where id = auth.uid()
$$;

revoke all on function public.saya_role() from anon;
revoke all on function public.saya_kelas() from anon;

grant execute on function public.saya_role() to authenticated;
grant execute on function public.saya_kelas() to authenticated;

-- ---------- READ POLICIES (7 buah) ----------
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

-- Tidak ada policy INSERT/UPDATE/DELETE untuk authenticated.
-- Semua tulis lewat route handler server dengan service role.
