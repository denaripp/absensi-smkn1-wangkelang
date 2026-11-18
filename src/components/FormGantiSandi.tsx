'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FormGantiSandi() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [ulangi, setUlangi] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setPesan(null)

    if (password !== ulangi) {
      setPesan('kedua sandi belum sama')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/ganti-sandi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setPesan(data.error ?? 'gagal ganti sandi')
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setPesan('tidak bisa menghubungi server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Sandi baru</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-[#EAECF0] px-4 py-3 text-[#111827] outline-none focus:border-[#8CE827]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Ulangi sandi baru</span>
        <input
          type="password"
          value={ulangi}
          onChange={(e) => setUlangi(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-[#EAECF0] px-4 py-3 text-[#111827] outline-none focus:border-[#8CE827]"
        />
      </label>

      {pesan && (
        <p role="alert" className="rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#EF4444]">
          {pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#8CE827] px-4 py-3 font-bold text-[#0F172A] transition hover:bg-[#7BE11D] disabled:opacity-60"
      >
        {loading ? 'Menyimpan…' : 'Simpan sandi baru'}
      </button>

      <button
        type="button"
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          router.replace('/')
          router.refresh()
        }}
        className="w-full rounded-full border border-[#EAECF0] px-4 py-3 text-sm font-semibold text-[#6B7280]"
      >
        Keluar
      </button>
    </form>
  )
}
