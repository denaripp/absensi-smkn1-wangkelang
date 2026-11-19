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

  // ==========================================
  // MODE 1: QR MENGAMBANG (PICTURE-IN-PICTURE)
  // ==========================================
  if (mode === 'mengambang') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-garis bg-kartu p-3.5 shadow-2xl transition-all animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between border-b border-garis pb-2">
          <div className="min-w-0 flex-1 pr-2">
            <p className="truncate text-xs font-bold text-teks-1">{sesi.mapel}</p>
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
              <span className="tabular font-mono font-bold text-emerald-600">{sisa}s</span>
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

  // ==========================================
  // MODE 2: MODAL PROYEKTOR JUMBO (PROPORSIONAL)
  // ==========================================
  const persenHadir = metrik.total > 0 ? Math.round((metrik.hadir / metrik.total) * 100) : 0

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 ${
        isFullscreen ? 'bg-kanvas' : 'bg-black/80 backdrop-blur-md'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreen) onTutup()
      }}
    >
      <div className="relative flex max-h-[94vh] w-full max-w-lg flex-col items-center overflow-y-auto rounded-3xl border border-garis bg-kartu p-5 shadow-2xl sm:p-6">
        {/* Header Modal */}
        <div className="flex w-full items-start justify-between border-b border-garis pb-3">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Mode Proyektor · Presensi Siswa
            </p>
            <h2 className="mt-0.5 text-lg font-black leading-snug text-teks-1 sm:text-xl">
              {sesi.mapel}
            </h2>
            <p className="mt-0.5 text-xs text-teks-2">
              Kelas {sesi.kelas} · Dibuka {sesi.mulai}
            </p>
          </div>

          {/* Tombol Aksi Icon Ringkas (Hemat Ruang Horizontal) */}
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => onUbahMode('mengambang')}
              title="Pindahkan ke mode mengambang (PiP)"
              className="grid size-8 place-items-center rounded-xl border border-garis bg-kanvas text-teks-2 transition-all hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} className="text-xs" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Kecilkan Layar Penuh (F)' : 'Layar Penuh Proyektor (F)'}
              className="grid size-8 place-items-center rounded-xl border border-garis bg-kanvas text-teks-2 transition-all hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faTv} className="text-xs" />
            </button>

            <button
              type="button"
              onClick={onTutup}
              title="Tutup (Esc)"
              className="grid size-8 place-items-center rounded-xl border border-garis bg-kanvas text-teks-2 transition-all hover:bg-[#FEE2E2] hover:text-alpa active:scale-95"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          </div>
        </div>

        {/* QR Code Frame Berukuran Pas */}
        <div className="my-3.5 flex flex-col items-center">
          <div className="grid size-[260px] place-items-center rounded-2xl border border-gray-100 bg-white p-3.5 shadow-md sm:size-[290px] dark:border-zinc-800">
            {token ? (
              <QRCodeSVG
                value={token}
                size={isFullscreen ? 340 : 260}
                level="M"
                includeMargin={false}
              />
            ) : (
              <span className="text-xs text-teks-2">Memuat kode QR…</span>
            )}
          </div>

          {/* Indikator Hitung Mundur & Progress Bar */}
          <div className="mt-3.5 w-full max-w-xs text-center">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-teks-2">Kode berganti dalam</span>
              <span className="tabular font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {String(sisa).padStart(2, '0')} detik
              </span>
            </div>

            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>

            <p className="mt-2 text-center text-xs text-teks-2">
              Arahkan kamera ponsel siswa ke kode QR di atas
            </p>
          </div>
        </div>

        {/* Status Presensi Kompak */}
        <div className="flex w-full items-center justify-between rounded-xl bg-kanvas px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <FontAwesomeIcon icon={faUsers} className="text-xs" />
            </div>
            <div>
              <p className="text-xs font-bold text-teks-1">
                {metrik.hadir} dari {metrik.total} Siswa Hadir
              </p>
              <p className="text-[10px] text-teks-2">Tersinkronisasi otomatis</p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {persenHadir}% Presensi
          </span>
        </div>

        {/* Hint Tombol Keyboard */}
        <p className="mt-2 text-center text-[10px] text-teks-2">
          Pintasan: <kbd className="rounded border border-garis bg-kanvas px-1 py-0.5 font-mono text-[9px] text-teks-1">F</kbd> layar penuh · <kbd className="rounded border border-garis bg-kanvas px-1 py-0.5 font-mono text-[9px] text-teks-1">Esc</kbd> tutup
        </p>
      </div>
    </div>
  )
}
