'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ambilDeviceLockId, buatFingerprintBrowser } from '@/lib/kunci'

type Peran = 'GURU' | 'SISWA'

export default function FormMasuk() {
  const router = useRouter()
  const [peran, setPeran] = useState<Peran>('SISWA')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPesan(null)

    try {
      const body: Record<string, unknown> = { identifier, password, role: peran }
      if (peran === 'SISWA') {
        body.deviceLockId = ambilDeviceLockId()
        body.fingerprint = await buatFingerprintBrowser()
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string; role?: Peran; mustChangePassword?: boolean }

      if (!res.ok) {
        setPesan(data.error ?? 'gagal masuk')
        return
      }

      const tujuan = data.mustChangePassword ? '/ganti-sandi' : data.role === 'GURU' ? '/guru' : '/siswa'
      router.replace(tujuan)
      router.refresh()
    } catch {
      setPesan('tidak bisa menghubungi server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-[#F4F5F7] p-1">
        {(['SISWA', 'GURU'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPeran(r)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              peran === r ? 'bg-[#0F172A] text-white' : 'text-[#6B7280]'
            }`}
          >
            {r === 'SISWA' ? 'Siswa' : 'Guru'}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {peran === 'SISWA' ? 'NISN' : 'NIP'}
        </span>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          inputMode="numeric"
          className="mt-1 w-full rounded-xl border border-[#EAECF0] px-4 py-3 text-[#111827] outline-none focus:border-[#8CE827]"
          placeholder={peran === 'SISWA' ? '0061234501' : '198705122010011004'}
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-[#EAECF0] px-4 py-3 text-[#111827] outline-none focus:border-[#8CE827]"
          placeholder="••••••••"
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
        {loading ? 'Memproses…' : 'Masuk'}
      </button>

      {peran === 'SISWA' && (
        <p className="text-center text-xs text-[#6B7280]">
          HP ini akan dikunci ke akunmu setelah login pertama.
        </p>
      )}
    </form>
  )
}
