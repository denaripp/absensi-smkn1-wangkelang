import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

function inisial(nama: string) {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? '')
    .join('')
}

export default function TopBar({ nama, nip, tanggal }: { nama: string; nip: string; tanggal: string }) {
  return (
    <header className="rounded-2xl bg-kartu p-3 shadow-bento md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Menu utama" className="hidden items-center gap-1 rounded-full bg-kanvas p-1 md:flex">
          <span className="rounded-full bg-gelap px-4 py-1.5 text-xs font-semibold text-white">
            Dashboard
          </span>
          <span className="px-3 py-1.5 text-xs text-teks-2" title="Dibangun di Batch 7">
            Sesi Hari Ini
          </span>
          <span className="px-3 py-1.5 text-xs text-teks-2" title="Dibangun di Batch 7">
            Rekap Mapel
          </span>
          <span className="px-3 py-1.5 text-xs text-teks-2" title="Dibangun di Batch 7">
            Jadwal
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="hidden items-center gap-2 rounded-full border border-garis px-3 py-2 text-xs text-teks-2 sm:flex"
            title="Pencarian aktif setelah modul murid dibangun (Batch 7)"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              disabled
              aria-label="Pencarian belum tersedia"
              placeholder="Cari siswa, kelas, atau mapel"
              className="w-44 bg-transparent outline-none placeholder:text-teks-2"
            />
          </div>

          <span
            className="relative grid size-9 place-items-center rounded-full border border-garis text-teks-2"
            title="Notifikasi belum tersedia"
          >
            <FontAwesomeIcon icon={faBell} />
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-aksen text-[10px] font-bold text-gelap">
              0
            </span>
          </span>

          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-gelap text-xs font-bold text-white">
              {inisial(nama)}
            </span>
            <span className="hidden text-xs leading-tight md:block">
              <span className="block font-semibold">{nama}</span>
              <span className="block text-teks-2 tabular">{nip}</span>
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-teks-2">
        {tanggal} • Semester Ganjil
      </p>
    </header>
  )
}
