'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCompress,
  faXmark,
  faTv,
  faUpRightAndDownLeftFromCenter,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'

type Sesi = { id: string; mapel: string; kelas: string; mulai: string }
type Metrik = { hadir: number; total: number }

export default function ModalQRPembesar({
  mode,
  onTutup,
  onUbahMode,
  token,
  sisa,
  sesi,
  metrik,
}: {
  mode: 'modal' | 'mengambang' | 'normal'
  onTutup: () => void
  onUbahMode: (mode: 'modal' | 'mengambang') => void
  token: string | null
  sisa: number
  sesi: Sesi
  metrik: Metrik
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Handle keyboard shortcut (Esc untuk tutup/keluar fullscreen, F untuk toggle fullscreen)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (mode === 'normal') return
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        } else {
          onTutup()
        }
      } else if ((e.key === 'f' || e.key === 'F') && mode === 'modal') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          toggleFullscreen()
        }
      }
    }

    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [mode, onTutup])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (mode === 'normal') return null

  // MODE 1: QR MENGAMBANG (PICTURE-IN-PICTURE DI SUDUT BAWAH)
  if (mode === 'mengambang') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-garis bg-kartu p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between border-b border-garis pb-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold leading-tight text-teks-1">{sesi.mapel}</p>
            <p className="text-[10px] text-teks-2">Kelas {sesi.kelas} · QR Aktif</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUbahMode('modal')}
              title="Perbesar ke Mode Proyektor"
              className="grid size-7 place-items-center rounded-lg text-teks-2 transition-colors hover:bg-kanvas hover:text-teks-1"
            >
              <FontAwesomeIcon icon={faTv} className="text-xs" />
            </button>
            <button
              type="button"
              onClick={onTutup}
              title="Tutup Widget Mengambang"
              className="grid size-7 place-items-center rounded-lg text-teks-2 transition-colors hover:bg-kanvas hover:text-alpa"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col items-center">
          <div className="grid size-[190px] place-items-center rounded-xl bg-white p-2 shadow-inner">
            {token ? (
              <QRCodeSVG value={token} size={170} level="M" />
            ) : (
              <span className="text-xs text-teks-2">Memuat kode QR…</span>
            )}
          </div>

          <div className="mt-2.5 w-full text-center">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-hadir">
                <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                {metrik.hadir}/{metrik.total} hadir
              </span>
              <span className="tabular font-mono font-bold text-teks-2">{sisa}s</span>
            </div>

            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // MODE 2: MODAL PROYEKTOR JUMBO (LAYAR PENUH)
  const persenHadir = metrik.total > 0 ? Math.round((metrik.hadir / metrik.total) * 100) : 0

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
        isFullscreen ? 'bg-kanvas' : 'bg-black/85 backdrop-blur-md'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreen) onTutup()
      }}
    >
      <div className="relative flex w-full max-w-2xl flex-col items-center rounded-3xl border border-garis bg-kartu p-6 shadow-2xl sm:p-8">
        {/* Header Modal: Tipografi Elegan Tanpa Pill Slop */}
        <div className="flex w-full items-start justify-between border-b border-garis pb-4">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Mode Proyektor · Sesi Presensi Aktif
            </p>
            <h2 className="mt-1 truncate text-xl font-black leading-tight text-teks-1 sm:text-2xl">
              {sesi.mapel}
            </h2>
            <p className="mt-1 text-xs text-teks-2">
              Kelas {sesi.kelas} · Dibuka {sesi.mulai} · SMK Negeri 1 Wangkelang
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onUbahMode('mengambang')}
              title="Pindahkan ke sudut layar (PiP)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kanvas px-3 py-2 text-xs font-semibold text-teks-2 transition-all hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} className="text-[11px]" />
              <span className="hidden sm:inline">Mengambang</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Keluar dari layar penuh (F)' : 'Layar penuh proyektor (F)'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kanvas px-3 py-2 text-xs font-semibold text-teks-2 transition-all hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faTv} className="text-[11px]" />
              <span className="hidden sm:inline">{isFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
            </button>

            <button
              type="button"
              onClick={onTutup}
              title="Tutup (Esc)"
              className="grid size-9 place-items-center rounded-xl border border-garis bg-kanvas text-teks-2 transition-all hover:bg-[#FEE2E2] hover:text-alpa active:scale-95"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          </div>
        </div>

        {/* Kotak QR Code Jumbo Kontras Tinggi */}
        <div className="my-6 flex flex-col items-center">
          <div className="grid size-[320px] place-items-center rounded-3xl border border-gray-100 bg-white p-5 shadow-xl sm:size-[380px] dark:border-zinc-800">
            {token ? (
              <QRCodeSVG
                value={token}
                size={isFullscreen ? 340 : 310}
                level="M"
                includeMargin={false}
              />
            ) : (
              <span className="text-sm text-teks-2">Memuat kode QR…</span>
            )}
          </div>

          {/* Indikator Hitung Mundur & Kalimat Petunjuk Resmi */}
          <div className="mt-5 w-full max-w-sm text-center">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-teks-2">Pembaruan Kode Berikutnya</span>
              <span className="tabular font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {String(sisa).padStart(2, '0')} Detik
              </span>
            </div>

            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>

            <p className="mt-2.5 text-xs text-teks-2">
              Pindai kode QR menggunakan kamera ponsel atau aplikasi siswa untuk mencatat kehadiran.
            </p>
          </div>
        </div>

        {/* Footer Info Presensi Terpadu */}
        <div className="flex w-full items-center justify-between rounded-2xl bg-kanvas px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <FontAwesomeIcon icon={faUsers} />
            </span>
            <div>
              <p className="text-xs font-bold text-teks-1">
                {metrik.hadir} dari {metrik.total} Siswa Telah Hadir
              </p>
              <p className="text-[11px] text-teks-2">
                Sinkronisasi data kehadiran berlangsung otomatis
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {persenHadir}% Terisi
            </span>
          </div>
        </div>

        {/* Baris Pintasan Keyboard Ringan */}
        <p className="mt-3 text-[11px] text-teks-2">
          Tekan <kbd className="rounded bg-kanvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teks-1 border border-garis">F</kbd> untuk layar penuh · <kbd className="rounded bg-kanvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teks-1 border border-garis">Esc</kbd> untuk menutup
        </p>
      </div>
    </div>
  )
}
