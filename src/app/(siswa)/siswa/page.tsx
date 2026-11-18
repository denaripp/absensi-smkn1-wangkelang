import { connection } from 'next/server'
import PanelSesiSiswa from '@/components/PanelSesiSiswa'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { hariKeWIB, jamWIB } from '@/lib/format'
import { hitungMetrik } from '@/lib/rekap'

export const instant = false

const NAMA_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

const WARNA: Record<string, string> = {
  HADIR: 'text-hadir',
  HADIR_MANUAL: 'text-hadir',
  SAKIT: 'text-sakit',
  IZIN: 'text-izin',
  ALPA: 'text-alpa',
}

const LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  HADIR_MANUAL: 'Hadir manual',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  ALPA: 'Alpa',
}

export default async function DashboardSiswa() {
  await connection()

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profil } = user
    ? await supabase
        .from('users')
        .select('id, full_name, identifier, class_id')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  if (!profil) {
    return (
      <p className="rounded-2xl bg-kartu p-6 text-sm text-teks-2 shadow-bento">
        Profil siswa tidak ditemukan. Keluar lalu masuk kembali.
      </p>
    )
  }

  const [{ data: sesiRaw }, { data: logSaya }, { data: jadwalRaw }] = await Promise.all([
    profil.class_id
      ? supabase
          .from('sessions')
          .select('id, subject_id, teacher_id, started_at')
          .eq('class_id', profil.class_id)
          .eq('status', 'ACTIVE')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('attendance_logs')
      .select('id, session_id, status, scanned_at')
      .eq('student_id', profil.id)
      .order('scanned_at', { ascending: false }),
    profil.class_id
      ? supabase
          .from('schedules')
          .select('subject_id, jam_ke, jam_mulai, jam_selesai')
          .eq('class_id', profil.class_id)
          .eq('day_of_week', hariKeWIB())
          .order('jam_ke')
      : Promise.resolve({ data: [] }),
  ])

  const daftarLog = logSaya ?? []
  const metrik = hitungMetrik(daftarLog)

  // Nama mapel dibutuhkan untuk sesi aktif, jadwal, dan riwayat.
  const { data: semuaMapel } = await supabase.from('teacher_subjects').select('id, subject_name')
  const namaMapel = new Map((semuaMapel ?? []).map((m) => [m.id, m.subject_name]))

  let sesi: { id: string; mapel: string; guru: string; mulai: string } | null = null
  if (sesiRaw) {
    // Nama guru tidak terbaca lewat RLS siswa (users_baca hanya baris sendiri) → baca di server.
    const admin = createAdminClient()
    const { data: guru } = await admin
      .from('users')
      .select('full_name')
      .eq('id', sesiRaw.teacher_id)
      .maybeSingle()

    sesi = {
      id: sesiRaw.id,
      mapel: namaMapel.get(sesiRaw.subject_id) ?? 'Mata pelajaran',
      guru: guru?.full_name ?? 'Guru pengampu',
      mulai: jamWIB(sesiRaw.started_at),
    }
  }

  const riwayat = daftarLog.slice(0, 5)
  const idSesiRiwayat = [...new Set(riwayat.map((r) => r.session_id))]
  const { data: sesiRiwayat } = idSesiRiwayat.length
    ? await supabase.from('sessions').select('id, subject_id').in('id', idSesiRiwayat)
    : { data: [] }
  const mapelRiwayat = new Map((sesiRiwayat ?? []).map((s) => [s.id, s.subject_id]))

  return (
    <div className="space-y-3 md:space-y-4">
      <PanelSesiSiswa classId={profil.class_id} sesi={sesi} />

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-teks-2">
          Metrik Kehadiranmu
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Hadir', nilai: metrik.hadir, ket: `${metrik.persen}% kerajinan`, warna: 'text-hadir', bg: 'bg-[#DCFCE7]' },
            { label: 'Sakit', nilai: metrik.sakit, ket: 'surat dokter', warna: 'text-sakit', bg: 'bg-[#F3E8FF]' },
            { label: 'Izin', nilai: metrik.izin, ket: 'keperluan keluarga', warna: 'text-izin', bg: 'bg-[#FEF3C7]' },
            { label: 'Alpa', nilai: metrik.alpa, ket: 'tanpa keterangan', warna: 'text-alpa', bg: 'bg-[#FEE2E2]' },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-kartu p-4 shadow-bento">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${m.bg} ${m.warna}`}>
                {m.label}
              </span>
              <p className={`tabular mt-2 text-3xl font-black ${m.warna}`}>{m.nilai}</p>
              <p className="text-[11px] text-teks-2">{m.ket}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">Jadwal Hari Ini</h2>
        <p className="text-xs text-teks-2">{NAMA_HARI[hariKeWIB() - 1] ?? 'Hari ini'}</p>

        <ul className="mt-3 space-y-2">
          {(jadwalRaw ?? []).length === 0 && (
            <li className="rounded-xl bg-kanvas px-4 py-3 text-sm text-teks-2">
              Tidak ada jadwal pelajaran untuk kelasmu hari ini.
            </li>
          )}
          {(jadwalRaw ?? []).map((j) => (
            <li
              key={`${j.jam_ke}-${j.subject_id}`}
              className="flex items-center justify-between rounded-xl bg-kanvas px-4 py-3"
            >
              <span className="text-sm font-medium">
                {namaMapel.get(j.subject_id) ?? 'Mata pelajaran'}
              </span>
              <span className="tabular text-xs text-teks-2">
                {String(j.jam_mulai).slice(0, 5)}–{String(j.jam_selesai).slice(0, 5)}
                {' · jam ke-'}
                {j.jam_ke}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">Riwayat Presensi Terakhir</h2>

        <ul className="mt-3 divide-y divide-garis">
          {riwayat.length === 0 && (
            <li className="py-3 text-sm text-teks-2">Belum ada riwayat presensi.</li>
          )}
          {riwayat.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {namaMapel.get(mapelRiwayat.get(r.session_id) ?? '') ?? 'Mata pelajaran'}
                </p>
                <p className="tabular text-[11px] text-teks-2">{jamWIB(r.scanned_at)} WIB</p>
              </div>
              <span className={`text-xs font-bold ${WARNA[r.status] ?? 'text-teks-2'}`}>
                {LABEL[r.status] ?? r.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
