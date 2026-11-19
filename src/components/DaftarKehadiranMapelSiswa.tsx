import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faTriangleExclamation,
  faCircleXmark,
  faClock,
} from '@fortawesome/free-solid-svg-icons'
import type { RekapMapelSiswa, StatusEvaluasiPresensi } from '@/lib/rekap'

function badgeEvaluasi(status: StatusEvaluasiPresensi) {
  switch (status) {
    case 'AMAN':
      return {
        label: 'Aman',
        icon: faCircleCheck,
        badgeCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
        barCls: 'bg-emerald-600',
      }
    case 'PERINGATAN':
      return {
        label: 'Peringatan (≥75%)',
        icon: faTriangleExclamation,
        badgeCls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
        barCls: 'bg-amber-500',
      }
    case 'KRITIS':
      return {
        label: 'Batas Kritis (<75%)',
        icon: faCircleXmark,
        badgeCls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
        barCls: 'bg-rose-600',
      }
    case 'BELUM_ADA_SESI':
    default:
      return {
        label: 'Belum Ada Sesi',
        icon: faClock,
        badgeCls: 'bg-kanvas text-teks-2',
        barCls: 'bg-garis',
      }
  }
}

export default function DaftarKehadiranMapelSiswa({
  daftarMapel,
}: {
  daftarMapel: RekapMapelSiswa[]
}) {
  return (
    <section className="rounded-2xl bg-kartu p-5 shadow-bento">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <div>
          <h2 className="text-base font-bold text-teks-1">Presensi Per Mata Pelajaran</h2>
          <p className="mt-0.5 text-xs text-teks-2">
            Pantau tingkat kehadiran dan syarat kelayakan ujian semester (minimal 75%).
          </p>
        </div>
        <span className="text-[11px] font-semibold text-teks-2">
          {daftarMapel.length} Mata Pelajaran
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {daftarMapel.length === 0 && (
          <div className="col-span-full rounded-xl bg-kanvas p-4 text-center text-xs text-teks-2">
            Belum ada mata pelajaran yang terdaftar untuk kelasmu.
          </div>
        )}

        {daftarMapel.map((item) => {
          const cfg = badgeEvaluasi(item.status)
          const barWidth = item.persen !== null ? Math.min(100, Math.max(0, item.persen)) : 0

          return (
            <div
              key={item.subjectId}
              className="flex flex-col justify-between rounded-xl border border-garis bg-kanvas/60 p-4 transition-all hover:border-gray-300 dark:hover:border-zinc-700"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-teks-1" title={item.subjectName}>
                      {item.subjectName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-teks-2">{item.teacherName}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="tabular font-mono text-xl font-black text-teks-1">
                      {item.persen !== null ? `${item.persen}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-garis">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.barCls}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>

              {/* Status footer kartu */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-garis/60 pt-2.5 text-xs">
                <span className="text-[11px] text-teks-2">
                  {item.totalPertemuan > 0
                    ? `${item.hadir} dari ${item.totalPertemuan} pertemuan hadir`
                    : 'Belum ada pertemuan'}
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badgeCls}`}
                >
                  <FontAwesomeIcon icon={cfg.icon} className="text-[9px]" />
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
