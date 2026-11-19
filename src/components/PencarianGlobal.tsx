'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBook,
  faGraduationCap,
  faMagnifyingGlass,
  faSchool,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

type HasilCari = {
  siswa: { id: string; nama: string; nisn: string; kelas: string }[]
  kelas: { id: string; nama: string; jurusan: string }[]
  mapel: { id: string; nama: string }[]
}

const KOSONG: HasilCari = { siswa: [], kelas: [], mapel: [] }

export default function PencarianGlobal() {
  const router = useRouter()
  const [kueri, setKueri] = useState('')
  const [hasil, setHasil] = useState<HasilCari>(KOSONG)
  const [loading, setLoading] = useState(false)
  const [buka, setBuka] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wadahRef = useRef<HTMLDivElement>(null)

  // Shortcut keyboard: Ctrl+K atau '/' untuk fokus pencarian
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        inputRef.current?.focus()
        setBuka(true)
      } else if (e.key === 'Escape') {
        setBuka(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) {
        setBuka(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Debounced live search
  useEffect(() => {
    const q = kueri.trim()
    if (q.length < 2) return

    let batal = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/cari?q=${encodeURIComponent(q)}`)
        if (res.ok && !batal) {
          const data = (await res.json()) as HasilCari
          setHasil(data)
          setBuka(true)
        }
      } catch {
        // Abaikan galat jaringan sementara
      } finally {
        if (!batal) setLoading(false)
      }
    }, 150)

    return () => {
      batal = true
      clearTimeout(timer)
    }
  }, [kueri])

  function pilih(url: string) {
    setBuka(false)
    setKueri('')
    router.push(url)
  }

  const hasilTampil = kueri.trim().length < 2 ? KOSONG : hasil
  const adaHasil =
    hasilTampil.siswa.length > 0 || hasilTampil.kelas.length > 0 || hasilTampil.mapel.length > 0

  return (
    <div ref={wadahRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-garis bg-kanvas px-3 py-1.5 text-xs text-teks-2 transition focus-within:border-teks focus-within:bg-kartu">
        <FontAwesomeIcon
          icon={loading ? faSpinner : faMagnifyingGlass}
          className={loading ? 'animate-spin text-aksen' : ''}
        />
        <input
          ref={inputRef}
          type="text"
          value={kueri}
          onChange={(e) => {
            setKueri(e.target.value)
            setBuka(true)
          }}
          onFocus={() => {
            if (kueri.trim().length >= 2) setBuka(true)
          }}
          placeholder="Cari siswa, kelas, mapel… (Ctrl+K)"
          className="w-36 bg-transparent text-teks outline-none placeholder:text-teks-2 md:w-56"
        />
        {kueri && (
          <button
            type="button"
            onClick={() => {
              setKueri('')
              setBuka(false)
            }}
            className="text-[10px] text-teks-2 hover:text-teks"
          >
            ✕
          </button>
        )}
      </div>

      {buka && kueri.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-garis bg-kartu p-2 shadow-bento md:w-84">
          {!adaHasil && !loading && (
            <p className="p-3 text-center text-xs text-teks-2">
              Tidak ada hasil untuk &quot;{kueri}&quot;
            </p>
          )}

          {hasilTampil.siswa.length > 0 && (
            <div className="mb-2">
              <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-teks-2">
                Siswa
              </span>
              <ul className="space-y-0.5">
                {hasilTampil.siswa.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pilih(`/guru/murid`)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition hover:bg-kanvas"
                    >
                      <FontAwesomeIcon icon={faGraduationCap} className="text-aksen" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-teks">{s.nama}</p>
                        <p className="truncate text-[10px] text-teks-2">
                          {s.nisn} • {s.kelas}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasilTampil.kelas.length > 0 && (
            <div className="mb-2">
              <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-teks-2">
                Kelas
              </span>
              <ul className="space-y-0.5">
                {hasilTampil.kelas.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => pilih(`/guru/kelas`)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition hover:bg-kanvas"
                    >
                      <FontAwesomeIcon icon={faSchool} className="text-hadir" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-teks">{k.nama}</p>
                        <p className="truncate text-[10px] text-teks-2">{k.jurusan}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasilTampil.mapel.length > 0 && (
            <div>
              <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-teks-2">
                Mata Pelajaran
              </span>
              <ul className="space-y-0.5">
                {hasilTampil.mapel.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => pilih(`/guru/mapel`)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition hover:bg-kanvas"
                    >
                      <FontAwesomeIcon icon={faBook} className="text-sakit" />
                      <p className="truncate font-medium text-teks">{m.nama}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
