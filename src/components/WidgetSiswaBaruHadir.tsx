'use client'

type Siswa = { id: string; nama: string; nisn: string }

function inisial(nama: string) {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? '')
    .join('')
}

const BG_AVATAR = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-teal-600',
]

export default function WidgetSiswaBaruHadir({
  roster,
  status,
}: {
  roster: Siswa[]
  status: Record<string, string>
}) {
  const hadirList = roster.filter(
    (s) => status[s.id] === 'HADIR' || status[s.id] === 'HADIR_MANUAL',
  )
  const limaTerbaru = hadirList.slice(-5).reverse()

  return (
    <div className="rounded-2xl border border-garis bg-kanvas p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teks-2">
          Siswa Baru Saja Hadir
        </h3>
        <span className="tabular text-xs font-semibold text-hadir">
          {hadirList.length} siswa
        </span>
      </div>

      {limaTerbaru.length === 0 ? (
        <p className="mt-3 text-xs text-teks-2">
          Belum ada siswa yang memindai QR pada sesi ini.
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          {/* Overlapping avatar stack */}
          <div className="flex -space-x-2 overflow-hidden py-1">
            {limaTerbaru.map((s, idx) => (
              <span
                key={s.id}
                title={`${s.nama} (${s.nisn})`}
                className={`inline-grid size-8 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm ring-1 ring-black/5 ${
                  BG_AVATAR[idx % BG_AVATAR.length]
                }`}
              >
                {inisial(s.nama)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-teks">
              {limaTerbaru[0]?.nama}
            </p>
            <p className="truncate text-[11px] text-teks-2">
              {limaTerbaru.length > 1
                ? `dan ${limaTerbaru.length - 1} siswa lainnya hadir`
                : 'baru saja hadir'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
