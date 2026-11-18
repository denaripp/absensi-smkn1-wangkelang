'use client'

import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'

function inisial(nama: string) {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ShellSiswa({
  nama,
  nisn,
  kelas,
  terkunci,
  children,
}: {
  nama: string
  nisn: string
  kelas: string
  terkunci: boolean
  children: React.ReactNode
}) {
  const router = useRouter()

  async function keluar() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-kanvas p-3 md:p-6">
      <div className="mx-auto max-w-3xl space-y-3 md:space-y-4">
        <header className="rounded-2xl bg-kartu p-4 shadow-bento">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-gelap text-sm font-bold text-white">
              {inisial(nama)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight">{nama}</p>
              <p className="tabular text-xs text-teks-2">
                {nisn} • {kelas}
              </p>
            </div>

            <button
              type="button"
              onClick={keluar}
              title="Keluar"
              aria-label="Keluar"
              className="grid size-9 place-items-center rounded-full border border-garis text-teks-2"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                terkunci ? 'bg-aksen-lembut text-gelap' : 'bg-kanvas text-teks-2'
              }`}
              title={
                terkunci
                  ? 'HP ini terikat ke akunmu. Login dari HP lain akan ditolak.'
                  : 'Kunci perangkat dibuat saat login pertama.'
              }
            >
              <FontAwesomeIcon icon={faLock} className="text-[10px]" />
              {terkunci ? 'Perangkat Terkunci (HP Ini)' : 'Perangkat belum terkunci'}
            </span>
          </div>
        </header>

        <main className="space-y-3 md:space-y-4">{children}</main>

        <p className="pb-2 pt-1 text-center text-xs text-teks-2">
          Sistem Absensi: SMK Negeri 1 Wangkelang
        </p>
      </div>
    </div>
  )
}
