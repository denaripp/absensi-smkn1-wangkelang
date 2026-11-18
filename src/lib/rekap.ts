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
