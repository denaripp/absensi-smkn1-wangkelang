'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCheckCircle,
  faCircleStop,
  faRotateRight,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'

export default function KontrolSimulasiSiswa({
  adaSesi,
  sudahAbsen,
  statusAbsen,
}: {
  adaSesi: boolean
  sudahAbsen: boolean
  statusAbsen?: string | null
}) {
  const router = useRouter()
  const [memuat, setMemuat] = useState(false)
  const [pesan, setPesan] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)

  async function jalankanAksi(aksi: 'buka' | 'tutup' | 'absen-otomatis' | 'reset-absen' | 'token') {
    setMemuat(true)
    setPesan(null)
    try {
      const res = await fetch('/api/simulasi/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: aksi }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPesan(data.error ?? 'Gagal memproses simulasi')
        return
      }

      if (aksi === 'token' && data.urlScan) {
        setLinkToken(data.urlScan)
        return
      }

      setPesan(data.pesan ?? 'Aksi simulasi berhasil')
      router.refresh()
    } catch {
      setPesan('Koneksi ke server simulasi gagal')
    } finally {
      setMemuat(false)
    }
  }

  if (!adaSesi) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              <FontAwesomeIcon icon={faBolt} className="text-[11px]" />
              Simulasi Kelas Demo
            </div>
            <p className="mt-0.5 text-xs text-teks-2">
              Buka sesi aktif kelas XII RPL 1 untuk menguji alur presensi siswa secara langsung.
            </p>
          </div>

          <button
            type="button"
            onClick={() => jalankanAksi('buka')}
            disabled={memuat}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-aksen px-4 py-2.5 text-xs font-bold text-gelap shadow-sm transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faBolt} className="text-[11px]" />
            {memuat ? 'Membuka Sesi…' : 'Buka Sesi Simulasi'}
          </button>
        </div>

        {pesan && (
          <p className="mt-2.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {pesan}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-garis bg-kanvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-garis pb-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teks-2">
          <FontAwesomeIcon icon={faBolt} className="text-aksen" />
          Toolbar Simulasi Presensi
        </span>

        <button
          type="button"
          onClick={() => jalankanAksi('tutup')}
          disabled={memuat}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-alpa transition-colors hover:underline disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faCircleStop} className="text-[10px]" />
          Tutup Sesi
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sudahAbsen ? (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-aksen-lembut px-3 py-2 text-xs font-bold text-gelap">
              <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-700" />
              Tercatat {statusAbsen ?? 'HADIR'}
            </div>

            <button
              type="button"
              onClick={() => jalankanAksi('reset-absen')}
              disabled={memuat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kartu px-3 py-2 text-xs font-semibold text-teks-1 transition-all hover:bg-kanvas active:scale-95 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faRotateRight} className="text-[11px] text-teks-2" />
              Reset Presensi Saya
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => jalankanAksi('absen-otomatis')}
              disabled={memuat}
              className="inline-flex items-center gap-1.5 rounded-xl bg-aksen px-3.5 py-2 text-xs font-bold text-gelap shadow-sm transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faBolt} className="text-[11px]" />
              {memuat ? 'Memproses…' : 'Presensi Cepat (Simulasi Scan)'}
            </button>

            <button
              type="button"
              onClick={() => jalankanAksi('token')}
              disabled={memuat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kartu px-3 py-2 text-xs font-semibold text-teks-1 transition-all hover:bg-kanvas active:scale-95 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px] text-teks-2" />
              Dapatkan Link Token
            </button>
          </>
        )}
      </div>

      {linkToken && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-kartu p-2.5 text-xs">
          <span className="truncate font-mono text-[11px] text-teks-2">{linkToken}</span>
          <Link
            href={linkToken}
            className="shrink-0 font-bold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
          >
            Buka Halaman Scan →
          </Link>
        </div>
      )}

      {pesan && (
        <p className="mt-2.5 text-[11px] font-medium text-teks-2">
          {pesan}
        </p>
      )}
    </div>
  )
}
