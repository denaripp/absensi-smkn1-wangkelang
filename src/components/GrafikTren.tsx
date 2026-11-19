import type { TitikTren } from '@/lib/rekap'

const HARI_KOSONG: TitikTren[] = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'].map((hari) => ({
  hari,
  hadir: 0,
  total: 0,
}))

export default function GrafikTren({ data }: { data: TitikTren[] }) {
  const ada = data.length > 0
  const batang = ada ? data : HARI_KOSONG
  const maks = Math.max(1, ...batang.map((b) => b.total))
  const rata = ada
    ? Math.round(
        (data.reduce((n, d) => n + d.hadir, 0) / Math.max(1, data.reduce((n, d) => n + d.total, 0))) *
          1000,
      ) / 10
    : 0

  return (
    <section className="rounded-2xl bg-kartu p-5 shadow-bento">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Tren Kehadiran Mingguan</h2>
          <p className="text-xs text-teks-2">
            {ada ? `Rata-rata ${rata}% dari ${data.length} pertemuan` : 'Belum ada pertemuan tercatat'}
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-kanvas p-1 text-[11px] font-semibold">
          <span className="rounded-full bg-gelap px-3 py-1 text-white">Mingguan</span>
        </div>
      </header>

      <div className="mt-5 flex h-40 items-end gap-3">
        {batang.map((b) => {
          const tinggi = b.total === 0 ? 6 : Math.max(10, Math.round((b.hadir / maks) * 100))
          const aktif = b.total > 0 && b.hadir / Math.max(1, b.total) >= 0.9
          return (
            <div key={b.hari} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-32 w-full items-end justify-center">
                <div
                  className={`w-full max-w-9 rounded-t-xl ${aktif ? 'bg-aksen' : 'bg-garis'}`}
                  style={{ height: `${tinggi}%` }}
                  title={b.total === 0 ? `${b.hari}: belum ada data` : `${b.hari}: ${b.hadir}/${b.total} hadir`}
                />
                {aktif && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gelap px-2 py-1 text-[10px] font-semibold text-white">
                    {b.hadir}/{b.total} Hadir
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-teks-2">{b.hari}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
