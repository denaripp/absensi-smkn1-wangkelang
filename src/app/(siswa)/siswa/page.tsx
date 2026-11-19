import { connection } from 'next/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import PanelSesiSiswa from '@/components/PanelSesiSiswa'
import DaftarKehadiranMapelSiswa from '@/components/DaftarKehadiranMapelSiswa'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'
import { hariKeWIB, jamWIB } from '@/lib/format'
import { hitungMetrik, hitungKehadiranPerMapel } from '@/lib/rekap'

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

  const jar = await cookies()
  const sesiToken = verifikasiSesiToken(jar.get('app_session')?.value)
  const admin = createAdminClient()

  let userId = sesiToken?.id
  if (!userId) {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id
  }

  const { data: profil } = userId
    ? await admin
        .from('users')
        .select('id, full_name, identifier, class_id')
        .eq('id', userId)
        .maybeSingle()
    : { data: null }

  if (!profil) {
    return (
      <div className="rounded-2xl bg-kartu p-6 text-center text-sm text-teks-2 shadow-bento">
        <p className="font-semibold text-teks-1">Profil siswa tidak ditemukan</p>
        <p className="mt-1 text-xs">Sesi masuk tidak terdeteksi. Silakan kembali ke halaman masuk.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-aksen px-4 py-2 text-xs font-bold text-gelap">
          Halaman Masuk
        </Link>
      </div>
    )
  }

  const [
    { data: sesiRaw },
    { data: logSaya },
    { data: jadwalRaw },
    { data: semuaMapel },
    { data: sesiKelasRaw },
    { data: semuaGuru },
    { data: jadwalKelasSemua },
  ] = await Promise.all([
    profil.class_id
      ? admin
          .from('sessions')
          .select('id, subject_id, teacher_id, started_at')
          .eq('class_id', profil.class_id)
          .eq('status', 'ACTIVE')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('attendance_logs')
      .select('id, session_id, status, scanned_at')
      .eq('student_id', profil.id)
      .order('scanned_at', { ascending: false }),
    profil.class_id
      ? admin
          .from('schedules')
          .select('subject_id, jam_ke, jam_mulai, jam_selesai')
          .eq('class_id', profil.class_id)
          .eq('day_of_week', hariKeWIB())
          .order('jam_ke')
      : Promise.resolve({ data: [] }),
    admin.from('teacher_subjects').select('id, subject_name, teacher_id'),
    profil.class_id
      ? admin
          .from('sessions')
          .select('id, subject_id, status')
          .eq('class_id', profil.class_id)
      : Promise.resolve({ data: [] }),
    admin.from('users').select('id, full_name').eq('role', 'GURU'),
    profil.class_id
      ? admin.from('schedules').select('subject_id').eq('class_id', profil.class_id)
      : Promise.resolve({ data: [] }),
  ])

  const daftarLog = logSaya ?? []
  const metrik = hitungMetrik(daftarLog)

  const namaMapel = new Map((semuaMapel ?? []).map((m) => [m.id, m.subject_name]))
  const guruMap = new Map((semuaGuru ?? []).map((g) => [g.id, g.full_name]))

  const idMapelKelas = new Set([
    ...(jadwalKelasSemua ?? []).map((j) => j.subject_id),
    ...(sesiKelasRaw ?? []).map((s) => s.subject_id),
  ])
  const mapelKelasList = (semuaMapel ?? []).filter((m) => idMapelKelas.has(m.id))
  const mapelDitampilkan = mapelKelasList.length ? mapelKelasList : (semuaMapel ?? [])

  const rekapMapel = hitungKehadiranPerMapel({
    mapelList: mapelDitampilkan,
    sesiKelas: sesiKelasRaw ?? [],
    logSiswa: daftarLog,
    guruMap,
  })

  let sesi: { id: string; mapel: string; guru: string; mulai: string } | null = null
  if (sesiRaw) {
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
    ? await admin.from('sessions').select('id, subject_id').in('id', idSesiRiwayat)
    : { data: [] }
  const mapelRiwayat = new Map((sesiRiwayat ?? []).map((s: { id: string; subject_id: string }) => [s.id, s.subject_id]))

  const logSesiAktif = sesiRaw ? daftarLog.find((l) => l.session_id === sesiRaw.id) : null
  const sudahAbsen = Boolean(logSesiAktif)
  const statusAbsen = logSesiAktif ? (LABEL[logSesiAktif.status] ?? logSesiAktif.status) : null

  return (
    <div className="space-y-3 md:space-y-4">
      <PanelSesiSiswa
        classId={profil.class_id}
        sesi={sesi}
        sudahAbsen={sudahAbsen}
        statusAbsen={statusAbsen}
      />

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

      <DaftarKehadiranMapelSiswa daftarMapel={rekapMapel} />

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
