'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PencarianGlobal from '@/components/PencarianGlobal'
import MenuNotifikasi from '@/components/MenuNotifikasi'
import MenuProfilGuru from '@/components/MenuProfilGuru'

const MENU = [
  { href: '/guru', label: 'Dashboard' },
  { href: '/guru/murid', label: 'Data Murid' },
  { href: '/guru/kelas', label: 'Kelas' },
  { href: '/guru/mapel', label: 'Mapel & Jadwal' },
  { href: '/guru/rekap', label: 'Rekap' },
]

export default function TopBar({
  nama,
  nip,
  tanggal,
}: {
  nama: string
  nip: string
  tanggal: string
}) {
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

        <div className="ml-auto flex items-center gap-2.5">
          <PencarianGlobal />
          <MenuNotifikasi />
          <MenuProfilGuru nama={nama} nip={nip} />
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-teks-2">
        {tanggal} • Semester Ganjil
      </p>
    </header>
  )
}
