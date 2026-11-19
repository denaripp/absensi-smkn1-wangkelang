import { connection } from 'next/server'
import Link from 'next/link'
import PanelSesi from '@/components/PanelSesi'
import GrafikTren from '@/components/GrafikTren'
import KartuIdentitasGuru from '@/components/KartuIdentitasGuru'
import { createServerSupabase } from '@/lib/supabase/server'
import { jamWIB, sapaanWIB, tanggalTujuhHariLaluWIB } from '@/lib/format'
import { trenMingguan } from '@/lib/rekap'

export const instant = false

type TitikHari = { tanggal: string; hadir: number; total: number }

export default async function DashboardGuru() {
  await connection()

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profil } = user
    ? await supabase.from('users').select('id, full_name, identifier').eq('id', user.id).single()
    : { data: null }

  if (!profil) {
    return (
      <p className="rounded-2xl bg-kartu p-6 text-sm text-teks-2 shadow-bento">
        Profil guru tidak ditemukan. Keluar lalu masuk kembali.
      </p>
    )
  }

  const [{ data: mapelRaw }, { data: kelasRaw }, { data: sesiRaw }] = await Promise.all([
    supabase.from('teacher_subjects').select('id, subject_name').eq('teacher_id', profil.id).order('subject_name'),
    supabase.from('classes').select('id, class_name, major').order('class_name'),
    supabase
      .from('sessions')
      .select('id, class_id, subject_id, started_at')
      .eq('teacher_id', profil.id)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
  ])

  const mapelList = (mapelRaw ?? []).map((m) => ({ id: m.id, nama: m.subject_name }))
  const kelasList = (kelasRaw ?? []).map((k) => ({ id: k.id, nama: k.class_name }))

  let sesi: { id: string; mapel: string; kelas: string; mulai: string } | null = null
  let roster: { id: string; nama: string; nisn: string }[] = []
  let statusAwal: Record<string, string> = {}

  if (sesiRaw) {
    const namaMapel = mapelList.find((m) => m.id === sesiRaw.subject_id)?.nama ?? 'Mata pelajaran'
    const namaKelas = kelasList.find((k) => k.id === sesiRaw.class_id)?.nama ?? 'Kelas'

    const [{ data: siswa }, { data: logs }] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, identifier')
        .eq('class_id', sesiRaw.class_id)
        .eq('role', 'SISWA')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('attendance_logs').select('student_id, status').eq('session_id', sesiRaw.id),
    ])

    roster = (siswa ?? []).map((s) => ({ id: s.id, nama: s.full_name, nisn: s.identifier }))
    statusAwal = Object.fromEntries((logs ?? []).map((l) => [l.student_id, l.status]))
    sesi = { id: sesiRaw.id, mapel: namaMapel, kelas: namaKelas, mulai: jamWIB(sesiRaw.started_at) }
  }

  const awalMinggu = tanggalTujuhHariLaluWIB()
  const { data: sesiMinggu } = await supabase
    .from('sessions')
    .select('id, session_date, class_id')
    .eq('teacher_id', profil.id)
    .gte('session_date', awalMinggu)

  let tren: ReturnType<typeof trenMingguan> = []
  const daftarSesiMinggu = sesiMinggu ?? []

  if (daftarSesiMinggu.length > 0) {
    const { data: logsMinggu } = await supabase
      .from('attendance_logs')
      .select('session_id, status')
      .in('session_id', daftarSesiMinggu.map((s) => s.id))

    const perSesi = new Map<string, { tanggal: string; hadir: number; total: number }>()
    for (const s of daftarSesiMinggu) perSesi.set(s.id, { tanggal: s.session_date, hadir: 0, total: 0 })

    for (const log of logsMinggu ?? []) {
      const baris = perSesi.get(log.session_id)
      if (!baris) continue
      baris.total += 1
      if (log.status === 'HADIR' || log.status === 'HADIR_MANUAL') baris.hadir += 1
    }

    const perTanggal = new Map<string, TitikHari>()
    for (const baris of perSesi.values()) {
      const ada = perTanggal.get(baris.tanggal) ?? { tanggal: baris.tanggal, hadir: 0, total: 0 }
      ada.hadir += baris.hadir
      ada.total += baris.total
      perTanggal.set(baris.tanggal, ada)
    }

    tren = trenMingguan([...perTanggal.values()])
  }

  const jurusan = kelasRaw?.[0]?.major ?? 'SMK Negeri 1 Wangkelang'
  const namaKelasAktif = sesi?.kelas ?? null

  return (
    <div className="space-y-3 md:space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black leading-tight md:text-3xl">
            {sapaanWIB()}, {profil.full_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-teks-2">
            Pantau kehadiran siswa secara real-time. Sesi aktif terkunci satu per kelas.
          </p>
        </div>
        <span className="rounded-full border border-garis bg-kartu px-3 py-1.5 text-xs font-semibold text-teks-2">
          {sesi ? `Sesi aktif • dibuka ${sesi.mulai}` : 'Belum ada sesi aktif'}
        </span>
      </header>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
        <div className="space-y-3 md:space-y-4 lg:col-span-8">
          <PanelSesi sesi={sesi} mapelList={mapelList} kelasList={kelasList} roster={roster} statusAwal={statusAwal} />
          <GrafikTren data={tren} />
        </div>

        <div className="space-y-3 md:space-y-4 lg:col-span-4">
          <KartuIdentitasGuru
            nama={profil.full_name}
            nip={profil.identifier}
            jurusan={jurusan}
            jumlahMapel={mapelList.length}
            kelasAktif={namaKelasAktif}
          />

          <section className="rounded-2xl bg-kartu p-5 shadow-bento">
            <h2 className="text-base font-semibold">Aksi Cepat</h2>
            <p className="mb-3 text-xs text-teks-2">Pintasan menu operasional kelas.</p>
            <div className="space-y-2">
              <Link
                href="/guru/rekap"
                className="block w-full rounded-full bg-aksen px-4 py-2.5 text-center text-xs font-bold text-gelap transition hover:bg-aksen-hover"
              >
                Ekspor Laporan Excel
              </Link>
              <Link
                href="/guru/murid"
                className="block w-full rounded-full border border-garis px-4 py-2.5 text-center text-xs font-semibold text-teks transition hover:bg-kanvas"
              >
                Kelola Data Murid
              </Link>
              <Link
                href="/guru/mapel"
                className="block w-full rounded-full border border-garis px-4 py-2.5 text-center text-xs font-semibold text-teks transition hover:bg-kanvas"
              >
                Kelola Mapel & Jadwal
              </Link>
            </div>
          </section>

          <section className="rounded-2xl bg-kartu p-5 shadow-bento">
            <h2 className="text-base font-semibold">Ringkasan Rekap</h2>
            <p className="text-xs text-teks-2">Semester Ganjil 2026/2027</p>
            <p className="tabular mt-3 text-3xl font-black">
              {tren.length === 0
                ? '—'
                : `${Math.round(
                    (tren.reduce((n, t) => n + t.hadir, 0) /
                      Math.max(1, tren.reduce((n, t) => n + t.total, 0))) *
                      1000,
                  ) / 10}%`}
            </p>
            <p className="text-[11px] text-teks-2">
              {tren.length === 0
                ? 'Belum ada pertemuan dalam 7 hari terakhir.'
                : `Dihitung dari ${tren.length} hari pertemuan terakhir.`}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
