'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ambilDeviceLockId, buatFingerprintBrowser } from '@/lib/kunci'

// Jalur cadangan saat kamera tidak bisa dipakai: token ditempel dari tautan guru.
export default function AbsenDariToken({ token }: { token: string }) {
  const router = useRouter()
  const [pesan, setPesan] = useState<string | null>(null)
  const [sukses, setSukses] = useState<string | null>(null)

  useEffect(() => {
    let batal = false

    async function kirim() {
      if (!token) {
        setPesan('token kosong. Minta guru menampilkan QR ulang.')
        return
      }
      try {
        const deviceLockId = ambilDeviceLockId()
        const fingerprint = await buatFingerprintBrowser()
        const res = await fetch('/api/absen', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, deviceLockId, fingerprint }),
        })
        const data = (await res.json()) as { status?: string; jam?: string; error?: string }
        if (batal) return

        if (!res.ok) {
          setPesan(data.error ?? 'gagal mencatat absensi')
          return
        }
        setSukses(`Hadir — ${data.jam} WIB`)
        router.refresh()
      } catch {
        if (!batal) setPesan('tidak bisa menghubungi server')
      }
    }

    kirim()
    return () => {
      batal = true
    }
  }, [token, router])

  return (
    <section className="rounded-2xl bg-kartu p-5 shadow-bento">
      <h2 className="text-base font-semibold">Presensi via Tautan Token</h2>
      <p className="mt-1 text-xs text-teks-2">Halaman ini dipakai kalau kamera HP tidak bisa dibuka.</p>

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
      {!sukses && !pesan && <p className="mt-3 text-sm text-teks-2">Memproses token…</p>}

      <Link
        href="/siswa"
        className="mt-4 inline-block rounded-full bg-gelap px-4 py-2.5 text-sm font-semibold text-white"
      >
        Kembali ke dashboard
      </Link>
    </section>
  )
}
