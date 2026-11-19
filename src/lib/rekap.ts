export type StatusAbsen = 'HADIR' | 'HADIR_MANUAL' | 'SAKIT' | 'IZIN' | 'ALPA'

export type Metrik = {
  hadir: number
  sakit: number
  izin: number
  alpa: number
  total: number
  persen: number
}

export function hitungMetrik(logs: { status: StatusAbsen | string }[]): Metrik {
  let hadir = 0
  let sakit = 0
  let izin = 0
  let alpa = 0

  for (const log of logs) {
    if (log.status === 'HADIR' || log.status === 'HADIR_MANUAL') hadir += 1
    else if (log.status === 'SAKIT') sakit += 1
    else if (log.status === 'IZIN') izin += 1
    else if (log.status === 'ALPA') alpa += 1
  }

  const total = hadir + sakit + izin + alpa
  const persen = total === 0 ? 0 : Math.round((hadir / total) * 1000) / 10

  return { hadir, sakit, izin, alpa, total, persen }
}

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export type TitikTren = { hari: string; hadir: number; total: number }

// Masukan: rekap per tanggal (YYYY-MM-DD). Keluaran urut Senin–Jumat, tanpa Sabtu/Minggu.
export function trenMingguan(
  perHari: { tanggal: string; hadir: number; total: number }[],
): TitikTren[] {
  return perHari
    .map((d) => {
      const hari = NAMA_HARI[new Date(`${d.tanggal}T00:00:00Z`).getUTCDay()]
      return { hari, hadir: d.hadir, total: d.total }
    })
    .filter((d) => d.hari !== 'Min' && d.hari !== 'Sab')
    .sort((a, b) => NAMA_HARI.indexOf(a.hari) - NAMA_HARI.indexOf(b.hari))
}

export type StatusEvaluasiPresensi = 'AMAN' | 'PERINGATAN' | 'KRITIS' | 'BELUM_ADA_SESI'

export type RekapMapelSiswa = {
  subjectId: string
  subjectName: string
  teacherName: string
  hadir: number
  sakit: number
  izin: number
  alpa: number
  totalPertemuan: number
  persen: number | null
  status: StatusEvaluasiPresensi
}

export function hitungKehadiranPerMapel({
  mapelList,
  sesiKelas,
  logSiswa,
  guruMap,
}: {
  mapelList: { id: string; subject_name: string; teacher_id?: string | null }[]
  sesiKelas: { id: string; subject_id: string; status?: string }[]
  logSiswa: { session_id: string; status: StatusAbsen | string }[]
  guruMap?: Map<string, string>
}): RekapMapelSiswa[] {
  const mapSessionKeMapel = new Map(sesiKelas.map((s) => [s.id, s.subject_id]))
  const logPerMapel = new Map<string, { status: StatusAbsen | string }[]>()

  for (const log of logSiswa) {
    const subjectId = mapSessionKeMapel.get(log.session_id)
    if (!subjectId) continue
    const list = logPerMapel.get(subjectId) ?? []
    list.push(log)
    logPerMapel.set(subjectId, list)
  }

  const totalSesiPerMapel = new Map<string, number>()
  for (const s of sesiKelas) {
    totalSesiPerMapel.set(s.subject_id, (totalSesiPerMapel.get(s.subject_id) ?? 0) + 1)
  }

  return mapelList.map((m) => {
    const logs = logPerMapel.get(m.id) ?? []
    const metrik = hitungMetrik(logs)
    const sesiCount = totalSesiPerMapel.get(m.id) ?? 0
    const totalPertemuan = Math.max(sesiCount, metrik.total)

    let persen: number | null = null
    let status: StatusEvaluasiPresensi = 'BELUM_ADA_SESI'

    if (totalPertemuan > 0) {
      persen = Math.round((metrik.hadir / totalPertemuan) * 1000) / 10
      if (persen >= 80) status = 'AMAN'
      else if (persen >= 75) status = 'PERINGATAN'
      else status = 'KRITIS'
    }

    return {
      subjectId: m.id,
      subjectName: m.subject_name,
      teacherName: (m.teacher_id && guruMap?.get(m.teacher_id)) || 'Guru Pengampu',
      hadir: metrik.hadir,
      sakit: metrik.sakit,
      izin: metrik.izin,
      alpa: metrik.alpa,
      totalPertemuan,
      persen,
      status,
    }
  })
}
