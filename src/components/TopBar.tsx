'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

const MENU = [
  { href: '/guru', label: 'Dashboard' },
  { href: '/guru/murid', label: 'Data Murid' },
  { href: '/guru/kelas', label: 'Kelas' },
  { href: '/guru/mapel', label: 'Mapel & Jadwal' },
  { href: '/guru/rekap', label: 'Rekap' },
]

function inisial(nama: string) {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? '')
    .join('')
}

export default function TopBar({ nama, nip, tanggal }: { nama: string; nip: string; tanggal: string }) {
  const jalur = usePathname()

  return (
    <header className="rounded-2xl bg-kartu p-3 shadow-bento md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Menu utama" className="hidden items-center gap-1 rounded-full bg-kanvas p-1 md:flex">
          {MENU.map((m) => {
            const aktif = jalur === m.href
            return (
              <Link
                key={m.href}
                href={m.href}
                prefetch={true}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  aktif ? 'bg-gelap text-white' : 'text-teks-2 hover:text-teks'
                }`}
              >
                {m.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/guru/murid"
            className="hidden items-center gap-2 rounded-full border border-garis px-3 py-2 text-xs text-teks-2 transition hover:border-teks-2 sm:flex"
            title="Buka data murid untuk pencarian"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <span className="w-36 text-teks-2">Cari siswa atau kelas…</span>
          </Link>

          <span
            className="relative grid size-9 place-items-center rounded-full border border-garis text-teks-2"
            title="Sistem aktif, tidak ada peringatan sistem"
          >
            <FontAwesomeIcon icon={faBell} />
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-aksen text-[10px] font-bold text-gelap">
              1
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
