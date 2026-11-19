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
  { href: '/guru', label: 'Dashboard', ikon: faHouse },
  { href: '/guru/murid', label: 'Data Murid', ikon: faUsers },
  { href: '/guru/kelas', label: 'Kelas', ikon: faSchool },
  { href: '/guru/mapel', label: 'Mapel', ikon: faBook },
  { href: '/guru/rekap', label: 'Rekap', ikon: faChartSimple },
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
      <Link
        href="/guru"
        title="Beranda SMK Negeri 1 Wangkelang"
        aria-label="Beranda SMK Negeri 1 Wangkelang"
        className="grid size-10 place-items-center rounded-2xl bg-aksen text-sm font-black text-gelap transition hover:bg-aksen-hover"
      >
        SM
      </Link>

      {MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          title={item.label}
          aria-label={item.label}
          aria-current={jalur === item.href ? 'page' : undefined}
          className={`grid size-10 place-items-center rounded-2xl text-sm transition ${
            jalur === item.href ? 'bg-gelap text-white' : 'text-teks-2 hover:bg-kanvas'
          }`}
        >
          <FontAwesomeIcon icon={item.ikon} />
        </Link>
      ))}

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
