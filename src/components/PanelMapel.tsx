'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mapel = { id: string; nama: string; jumlahSesi: number }

export default function PanelMapel({ mapelList }: { mapelList: Mapel[] }) {
  const router = useRouter()
  const [nama, setNama] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPesan(null)

    const res = await fetch(editId ? `/api/mapel/${editId}` : '/api/mapel', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nama }),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setPesan(data.error ?? 'gagal menyimpan')
      return
    }
    setNama('')
    setEditId(null)
    router.refresh()
  }

  async function hapus(id: string) {
    if (!window.confirm('Hapus mata pelajaran ini?')) return
    const res = await fetch(`/api/mapel/${id}`, { method: 'DELETE' })
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
        <h2 className="text-base font-semibold">{editId ? 'Ubah mapel' : 'Tambah mapel yang kamu ampu'}</h2>

        <form onSubmit={kirim} className="mt-3 flex flex-wrap gap-2">
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth: Basis Data"
            required
            className="min-w-[240px] flex-1 rounded-xl border border-garis px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-aksen px-4 py-2 text-sm font-bold text-gelap disabled:opacity-60"
          >
            {loading ? 'Menyimpan…' : editId ? 'Simpan' : 'Tambah'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null)
                setNama('')
              }}
              className="rounded-full border border-garis px-4 py-2 text-sm font-semibold text-teks-2"
            >
              Batal
            </button>
          )}
        </form>

        {pesan && <p className="mt-2 text-xs text-alpa">{pesan}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl bg-kartu shadow-bento">
        <table className="w-full text-left text-sm">
          <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
            <tr>
              <th className="px-4 py-3">Mata pelajaran</th>
              <th className="px-4 py-3">Sesi</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {mapelList.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-teks-2">
                  Belum ada mapel.
                </td>
              </tr>
            )}
            {mapelList.map((m) => (
              <tr key={m.id} className="border-t border-garis">
                <td className="px-4 py-2.5 font-medium">{m.nama}</td>
                <td className="tabular px-4 py-2.5 text-xs text-teks-2">{m.jumlahSesi}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(m.id)
                        setNama(m.nama)
                      }}
                      className="text-xs font-semibold text-teks underline"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => hapus(m.id)}
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
