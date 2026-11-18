'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Kelas = { id: string; nama: string; jurusan: string; tingkat: string; jumlahSiswa: number }

const KOSONG = { nama: '', jurusan: '', tingkat: 'XII' }

export default function PanelKelas({ kelasList }: { kelasList: Kelas[] }) {
  const router = useRouter()
  const [form, setForm] = useState(KOSONG)
  const [editId, setEditId] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPesan(null)

    const res = await fetch(editId ? `/api/kelas/${editId}` : '/api/kelas', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setPesan(data.error ?? 'gagal menyimpan')
      return
    }
    setForm(KOSONG)
    setEditId(null)
    router.refresh()
  }

  async function hapus(id: string) {
    if (!window.confirm('Hapus kelas ini?')) return
    const res = await fetch(`/api/kelas/${id}`, { method: 'DELETE' })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setPesan(data.error ?? 'gagal menghapus')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">{editId ? 'Ubah kelas' : 'Tambah kelas'}</h2>

        <form onSubmit={kirim} className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Nama kelas (XII RPL 1)"
            required
            className="rounded-xl border border-garis px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={form.jurusan}
            onChange={(e) => setForm({ ...form, jurusan: e.target.value })}
            placeholder="Jurusan"
            required
            className="rounded-xl border border-garis px-3 py-2 text-sm"
          />
          <select
            value={form.tingkat}
            onChange={(e) => setForm({ ...form, tingkat: e.target.value })}
            className="rounded-xl border border-garis px-3 py-2 text-sm"
          >
            {['X', 'XI', 'XII'].map((t) => (
              <option key={t} value={t}>
                Tingkat {t}
              </option>
            ))}
          </select>

          <div className="flex gap-2 md:col-span-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-aksen px-4 py-2 text-sm font-bold text-gelap disabled:opacity-60"
            >
              {loading ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Tambah kelas'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null)
                  setForm(KOSONG)
                }}
                className="rounded-full border border-garis px-4 py-2 text-sm font-semibold text-teks-2"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        {pesan && <p className="mt-2 text-xs text-alpa">{pesan}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl bg-kartu shadow-bento">
        <table className="w-full text-left text-sm">
          <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
            <tr>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Jurusan</th>
              <th className="px-4 py-3">Tingkat</th>
              <th className="px-4 py-3">Siswa</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kelasList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-teks-2">
                  Belum ada kelas.
                </td>
              </tr>
            )}
            {kelasList.map((k) => (
              <tr key={k.id} className="border-t border-garis">
                <td className="px-4 py-2.5 font-medium">{k.nama}</td>
                <td className="px-4 py-2.5 text-xs text-teks-2">{k.jurusan}</td>
                <td className="px-4 py-2.5 text-xs">{k.tingkat}</td>
                <td className="tabular px-4 py-2.5 text-xs">{k.jumlahSiswa}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(k.id)
                        setForm({ nama: k.nama, jurusan: k.jurusan, tingkat: k.tingkat })
                      }}
                      className="text-xs font-semibold text-teks underline"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => hapus(k.id)}
                      className="text-xs font-semibold text-alpa underline"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
