'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook,
  faChartSimple,
  faHouse,
  faRightFromBracket,
  faSchool,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'

const MENU = [
  { href: '/guru', label: 'Dashboard', ikon: faHouse, siap: true },
  { href: '/guru/murid', label: 'Data Murid', ikon: faUsers, siap: false },
  { href: '/guru/kelas', label: 'Kelas', ikon: faSchool, siap: false },
  { href: '/guru/mapel', label: 'Mapel', ikon: faBook, siap: false },
  { href: '/guru/rekap', label: 'Rekap', ikon: faChartSimple, siap: false },
]

export default function Dock() {
  const jalur = usePathname()
  const router = useRouter()

  async function keluar() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }

  return (
    <nav
      aria-label="Navigasi guru"
      className="sticky top-3 flex h-fit flex-col items-center gap-2 rounded-[28px] bg-kartu p-2 shadow-bento md:top-6"
    >
      <div className="grid size-10 place-items-center rounded-2xl bg-aksen text-sm font-black text-gelap">
        SM
      </div>

      {MENU.map((item) =>
        item.siap ? (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={jalur === item.href ? 'page' : undefined}
            className={`grid size-10 place-items-center rounded-2xl text-sm transition ${
              jalur === item.href ? 'bg-gelap text-white' : 'text-teks-2 hover:bg-kanvas'
            }`}
          >
            <FontAwesomeIcon icon={item.ikon} />
          </Link>
        ) : (
          <span
            key={item.href}
            role="link"
            aria-disabled="true"
            title={`${item.label} — dibangun di Batch 7`}
            aria-label={`${item.label} belum tersedia`}
            className="grid size-10 cursor-not-allowed place-items-center rounded-2xl text-sm text-teks-2 opacity-40"
          >
            <FontAwesomeIcon icon={item.ikon} />
          </span>
        ),
      )}

      <button
        type="button"
        onClick={keluar}
        title="Keluar"
        aria-label="Keluar"
        className="mt-2 grid size-10 place-items-center rounded-2xl text-sm text-teks-2 hover:bg-kanvas"
      >
        <FontAwesomeIcon icon={faRightFromBracket} />
      </button>
    </nav>
  )
}
