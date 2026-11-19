'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faKey, faRightFromBracket, faUserCheck } from '@fortawesome/free-solid-svg-icons'

function inisial(nama: string) {
  return nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? '')
    .join('')
}

export default function MenuProfilGuru({ nama, nip }: { nama: string; nip: string }) {
  const router = useRouter()
  const [buka, setBuka] = useState(false)
  const wadahRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) {
        setBuka(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function keluar() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }

  return (
    <div ref={wadahRef} className="relative">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-label="Menu akun guru"
        className="flex items-center gap-2 rounded-full p-1 transition hover:bg-kanvas"
      >
        <span className="grid size-9 place-items-center rounded-full bg-gelap text-xs font-bold text-white shadow-sm">
          {inisial(nama)}
        </span>
        <span className="hidden text-left text-xs leading-tight md:block">
          <span className="block font-semibold text-teks">{nama}</span>
          <span className="block text-teks-2 tabular">{nip}</span>
        </span>
      </button>

      {buka && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-garis bg-kartu p-3 shadow-bento">
          <div className="border-b border-garis pb-2.5">
            <p className="truncate text-xs font-bold text-teks">{nama}</p>
            <p className="tabular text-[11px] text-teks-2">NIP: {nip}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-aksen-lembut px-2 py-0.5 text-[10px] font-bold text-gelap">
              <FontAwesomeIcon icon={faUserCheck} className="text-[9px]" />
              Guru Pengampu
            </span>
          </div>

          <div className="mt-2 space-y-1">
            <Link
              href="/ganti-sandi"
              onClick={() => setBuka(false)}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-teks transition hover:bg-kanvas"
            >
              <FontAwesomeIcon icon={faKey} className="text-teks-2" />
              Ganti Kata Sandi
            </Link>

            <button
              type="button"
              onClick={keluar}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-alpa transition hover:bg-[#FEE2E2]"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
