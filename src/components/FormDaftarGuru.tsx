'use client'

import { useState } from 'react'
import Link from 'next/link'

const AWAL = { nip: '', nama: '', email: '', password: '', kodeSekolah: '' }

export default function FormDaftarGuru() {
  const [form, setForm] = useState(AWAL)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sukses, setSukses] = useState(false)
  const [loading, setLoading] = useState(false)

  function ubah(kunci: keyof typeof AWAL, nilai: string) {
    setForm((kini) => ({ ...kini, [kunci]: nilai }))
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPesan(null)

    try {
      const res = await fetch('/api/register-guru', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setPesan(data.error ?? 'Pendaftaran akun guru belum berhasil. Periksa kembali data Anda.')
        return
      }
      setSukses(true)
      setForm(AWAL)
    } catch {
      setPesan('Gagal terhubung ke server. Periksa koneksi internet Anda.')
    } finally {
      setLoading(false)
    }
  }

  if (sukses) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-xl bg-[#ECFCCB] px-4 py-3 font-semibold text-[#111827]">
          Pendaftaran akun guru berhasil. Silakan masuk menggunakan NIP dan kata sandi yang telah Anda daftarkan, kemudian perbarui kata sandi Anda.
        </p>
        <Link
          href="/"
          className="block rounded-full bg-[#8CE827] px-4 py-3 text-center font-bold text-[#0F172A] hover:bg-[#7BE11D]"
        >
          Menuju Halaman Login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={kirim} className="space-y-3">
      {[
        { kunci: 'nip' as const, label: 'NIP', tipe: 'text', placeholder: '198705122010011004' },
        { kunci: 'nama' as const, label: 'Nama lengkap', tipe: 'text', placeholder: 'Rahmat Hidayat, S.Pd.' },
        { kunci: 'email' as const, label: 'Email', tipe: 'email', placeholder: 'nama@smkn1wangkelang.sch.id' },
        { kunci: 'password' as const, label: 'Password (min. 8)', tipe: 'password', placeholder: '••••••••' },
        { kunci: 'kodeSekolah' as const, label: 'Kode rahasia sekolah', tipe: 'password', placeholder: '••••••••' },
      ].map((f) => (
        <label key={f.kunci} className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{f.label}</span>
          <input
            type={f.tipe}
            value={form[f.kunci]}
            onChange={(e) => ubah(f.kunci, e.target.value)}
            required
            placeholder={f.placeholder}
            className="mt-1 w-full rounded-xl border border-[#EAECF0] px-4 py-3 text-[#111827] outline-none focus:border-[#8CE827]"
          />
        </label>
      ))}

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
        {loading ? 'Mendaftar…' : 'Daftar'}
      </button>
    </form>
  )
}
