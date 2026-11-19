'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faExpand,
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

  // Handle tombol keyboard Esc dan F
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

  // MODE 1: QR MENGAMBANG (PICTURE-IN-PICTURE DI POJOK BAWAH)
  if (mode === 'mengambang') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-garis bg-kartu p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between border-b border-garis pb-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold leading-tight">{sesi.mapel}</p>
            <p className="text-[10px] text-teks-2">{sesi.kelas} • QR Mengambang</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUbahMode('modal')}
              title="Perbesar Layar Penuh"
              className="grid size-7 place-items-center rounded-lg hover:bg-kanvas text-teks-2 hover:text-teks-1"
            >
              <FontAwesomeIcon icon={faExpand} className="text-xs" />
            </button>
            <button
              type="button"
              onClick={onTutup}
              title="Tutup Widget Mengambang"
              className="grid size-7 place-items-center rounded-lg hover:bg-kanvas text-teks-2 hover:text-alpa"
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
              <span className="text-xs text-teks-2">Memuat QR…</span>
            )}
          </div>

          <div className="mt-2.5 w-full text-center">
            <div className="flex items-center justify-between text-[11px] font-semibold text-teks-2">
              <span className="flex items-center gap-1 text-hadir">
                <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                {metrik.hadir}/{metrik.total} hadir
              </span>
              <span className="tabular font-bold text-teks-1">{sisa}s</span>
            </div>

            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-aksen transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // MODE 2: MODAL PROYEKTOR JUMBO (LAYAR PENUH)
  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isFullscreen ? 'bg-kanvas' : 'bg-black/85 backdrop-blur-md'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreen) onTutup()
      }}
    >
      <div className="relative flex w-full max-w-2xl flex-col items-center rounded-3xl border border-garis bg-kartu p-6 shadow-2xl sm:p-8">
        {/* Header Modal */}
        <div className="flex w-full items-start justify-between border-b border-garis pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-aksen-lembut px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gelap">
                Mode Proyektor Layar Penuh
              </span>
              <span className="text-xs font-semibold text-teks-2">
                dibuka {sesi.mulai}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-black leading-tight sm:text-2xl">
              {sesi.mapel}
            </h2>
            <p className="text-xs font-medium text-teks-2">
              Kelas {sesi.kelas} • SMK Negeri 1 Wangkelang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUbahMode('mengambang')}
              title="Kecilkan ke Mode Mengambang (PiP)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kanvas px-3 py-2 text-xs font-semibold text-teks-2 hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} className="text-xs" />
              <span className="hidden sm:inline">Mengambang</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (F)'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-garis bg-kanvas px-3 py-2 text-xs font-semibold text-teks-2 hover:bg-kartu hover:text-teks-1 active:scale-95"
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faTv} className="text-xs" />
              <span className="hidden sm:inline">{isFullscreen ? 'Keluar' : 'Layar Penuh'}</span>
            </button>

            <button
              type="button"
              onClick={onTutup}
              title="Tutup (Esc)"
              className="grid size-9 place-items-center rounded-xl border border-garis bg-kanvas text-teks-2 hover:bg-[#FEE2E2] hover:text-alpa active:scale-95"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>
          </div>
        </div>

        {/* QR Code Jumbo */}
        <div className="my-6 flex flex-col items-center">
          <div className="grid size-[320px] place-items-center rounded-3xl bg-white p-5 shadow-2xl ring-4 ring-black/5 sm:size-[380px]">
            {token ? (
              <QRCodeSVG
                value={token}
                size={isFullscreen ? 340 : 310}
                level="M"
                includeMargin={false}
              />
            ) : (
              <span className="text-sm text-teks-2">Memuat QR Code…</span>
            )}
          </div>

          {/* Hitung Mundur & Progress Bar */}
          <div className="mt-5 w-full max-w-sm text-center">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-teks-2">Token Berputar Otomatis</span>
              <span className="tabular text-aksen font-extrabold">{String(sisa).padStart(2, '0')} Detik</span>
            </div>

            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-aksen transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-teks-2">
              Arahkan kamera smartphone ke QR Code di atas. Tanpa selfie, tanpa titip absen.
            </p>
          </div>
        </div>

        {/* Footer Info Presensi */}
        <div className="flex w-full items-center justify-between rounded-2xl bg-kanvas px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-aksen-lembut text-xs font-bold text-gelap">
              <FontAwesomeIcon icon={faUsers} />
            </span>
            <div>
              <p className="text-xs font-bold leading-tight">
                {metrik.hadir} dari {metrik.total} Siswa Hadir
              </p>
              <p className="text-[11px] text-teks-2">Status diperbarui realtime otomatis</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-hadir">
              {metrik.total > 0 ? Math.round((metrik.hadir / metrik.total) * 100) : 0}% Kehadiran
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
