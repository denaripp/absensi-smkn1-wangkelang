'use client'

import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faCheckCircle, faQrcode, faShieldHalved } from '@fortawesome/free-solid-svg-icons'

export default function MenuNotifikasi() {
  const [buka, setBuka] = useState(false)
  const [dibaca, setDibaca] = useState(false)
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

  function bukaTutup() {
    setBuka(!buka)
    if (!dibaca) setDibaca(true)
  }

  return (
    <div ref={wadahRef} className="relative">
      <button
        type="button"
        onClick={bukaTutup}
        aria-label="Pemberitahuan sistem"
        title="Pemberitahuan sistem"
        className="relative grid size-9 place-items-center rounded-full border border-garis text-teks-2 transition hover:bg-kanvas"
      >
        <FontAwesomeIcon icon={faBell} />
        {!dibaca && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-aksen text-[10px] font-bold text-gelap">
            1
          </span>
        )}
      </button>

      {buka && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-garis bg-kartu p-3 shadow-bento md:w-80">
          <div className="mb-2 flex items-center justify-between border-b border-garis pb-2">
            <h4 className="text-xs font-bold text-teks">Pemberitahuan Sistem</h4>
            <span className="rounded-full bg-aksen-lembut px-2 py-0.5 text-[10px] font-semibold text-gelap">
              Online
            </span>
          </div>

          <ul className="space-y-2">
            <li className="flex items-start gap-2.5 rounded-xl bg-kanvas p-2.5">
              <FontAwesomeIcon icon={faQrcode} className="mt-0.5 text-aksen" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-teks">Dynamic QR 15 Detik Siap</p>
                <p className="text-[11px] text-teks-2">
                  Token HMAC berputar otomatis tiap 15s di proyektor kelas.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-xl bg-kanvas p-2.5">
              <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 text-hadir" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-teks">Device Lock Aktif</p>
                <p className="text-[11px] text-teks-2">
                  Siswa terkunci 1 HP 1 akun untuk mencegah titip absen.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5 rounded-xl bg-kanvas p-2.5">
              <FontAwesomeIcon icon={faCheckCircle} className="mt-0.5 text-sakit" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-teks">Supabase Realtime Terkoneksi</p>
                <p className="text-[11px] text-teks-2">
                  Data absensi siswa terupdate seketika tanpa reload.
                </p>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
