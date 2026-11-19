'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ambilDeviceLockId, buatFingerprintBrowser } from '@/lib/kunci'

const ID_PEMBACA = 'pembaca-qr'

export default function ScannerQR({ onTutup }: { onTutup: () => void }) {
  const router = useRouter()
  const [pesan, setPesan] = useState<string | null>(null)
  const [sukses, setSukses] = useState<string | null>(null)
  const sudahKirim = useRef(false)

  useEffect(() => {
    let batal = false
    let mesin: { stop: () => Promise<void>; clear: () => void } | null = null

    async function kirimToken(token: string) {
      try {
        const deviceLockId = ambilDeviceLockId()
        const fingerprint = await buatFingerprintBrowser()
        const res = await fetch('/api/absen', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: token.trim(), deviceLockId, fingerprint }),
        })
        const data = (await res.json()) as { status?: string; jam?: string; error?: string }

        if (!res.ok) {
          setPesan(data.error ?? 'Gagal mencatat kehadiran. Silakan coba lagi.')
          sudahKirim.current = false
          return
        }

        setSukses(`Presensi Berhasil — Pukul ${data.jam} WIB`)
        router.refresh()
      } catch {
        setPesan('Gagal terhubung ke server. Periksa koneksi internet Anda.')
        sudahKirim.current = false
      }
    }

    async function mulai() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (batal) return

        const scanner = new Html5Qrcode(ID_PEMBACA, { verbose: false })
        mesin = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          async (teks) => {
            if (sudahKirim.current) return
            sudahKirim.current = true
            try {
              await scanner.stop()
              scanner.clear()
            } catch {
              // kamera sudah berhenti, abaikan
            }
            await kirimToken(teks)
          },
          () => {
            // frame tanpa QR, abaikan
          },
        )
      } catch (e) {
        const alasan = e instanceof Error ? e.message : String(e)
        setPesan(
          `Kamera tidak dapat diakses (${alasan}). Pastikan izin kamera telah diaktifkan di browser Anda.`,
        )
      }
    }

    mulai()

    return () => {
      batal = true
      if (mesin) {
        mesin
          .stop()
          .catch(() => {})
          .finally(() => mesin?.clear())
      }
    }
  }, [router])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gelap/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-kartu p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-teks-1">Pindai Kode QR Presensi</h2>
          <button
            type="button"
            onClick={onTutup}
            className="rounded-full border border-garis px-3 py-1 text-xs font-semibold text-teks-2 transition hover:bg-kanvas hover:text-teks-1"
          >
            Tutup
          </button>
        </div>

        <p className="mt-1 text-xs text-teks-2">Arahkan kamera ponsel ke kode QR di layar proyektor kelas.</p>

        <div className="relative mt-3 overflow-hidden rounded-2xl bg-black">
          <div id={ID_PEMBACA} className="min-h-[240px] w-full" />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-aksen" />
        </div>

        {sukses && (
          <p role="status" className="mt-3 rounded-xl bg-aksen-lembut px-4 py-3 text-sm font-bold text-gelap">
            {sukses}
          </p>
        )}

        {pesan && (
          <p role="alert" className="mt-3 rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-alpa">
            {pesan}
          </p>
        )}
      </div>
    </div>
  )
}
