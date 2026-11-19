'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Siswa = {
  id: string
  nisn: string
  nama: string
  classId: string
  kelas: string
  terkunci: boolean
}
type Kelas = { id: string; nama: string }

export default function PanelMurid({
  siswaList,
  kelasList,
}: {
  siswaList: Siswa[]
  kelasList: Kelas[]
}) {
  const router = useRouter()
  const [nisn, setNisn] = useState('')
  const [nama, setNama] = useState('')
  const [classId, setClassId] = useState(kelasList[0]?.id ?? '')
  const [filterKelas, setFilterKelas] = useState('')
  const [editSiswa, setEditSiswa] = useState<Siswa | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editClassId, setEditClassId] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const berkasRef = useRef<HTMLInputElement>(null)

  async function tambah(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setPesan(null)

    const res = await fetch('/api/siswa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nisn, nama, classId }),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setPesan(data.error ?? 'gagal menambah murid')
      return
    }
    setNisn('')
    setNama('')
    router.refresh()
  }

  async function unggah(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setPesan(null)

    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/siswa/import', { method: 'POST', body: form })
    const data = (await res.json()) as {
      dibuat?: number
      dilewati?: number
      gagal?: { baris: number; alasan: string }[]
      error?: string
    }
    setLoading(false)
    if (berkasRef.current) berkasRef.current.value = ''

    if (!res.ok) {
      setPesan(data.error ?? 'gagal mengimpor')
      return
    }
    const gagal = data.gagal ?? []
    setPesan(
      `Impor selesai: ${data.dibuat ?? 0} dibuat, ${data.dilewati ?? 0} dilewati` +
        (gagal.length ? `, ${gagal.length} gagal (baris ${gagal.map((g) => g.baris).join(', ')})` : ''),
    )
    router.refresh()
  }

  function mulaiEdit(s: Siswa) {
    setEditSiswa(s)
    setEditNama(s.nama)
    setEditClassId(s.classId || (kelasList[0]?.id ?? ''))
    setPesan(null)
  }

  async function simpanEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editSiswa) return
    setLoading(true)
    setPesan(null)

    const res = await fetch(`/api/siswa/${editSiswa.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nama: editNama, classId: editClassId }),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setPesan(data.error ?? 'gagal mengubah data murid')
      return
    }
    setEditSiswa(null)
    setPesan(`Data ${editNama} berhasil diperbarui.`)
    router.refresh()
  }

  async function resetDevice(id: string, namaSiswa: string) {
    if (!window.confirm(`Reset kunci HP ${namaSiswa}? Siswa bisa login dari HP baru setelah ini.`)) return
    const res = await fetch('/api/reset-device', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: id }),
    })
    const data = (await res.json()) as { error?: string }
    setPesan(res.ok ? `Kunci perangkat HP ${namaSiswa} berhasil direset.` : (data.error ?? 'Gagal mereset kunci HP'))
    if (res.ok) router.refresh()
  }

  async function hapus(id: string, namaSiswa: string) {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data ${namaSiswa}? Seluruh riwayat presensi siswa ini akan dihapus permanen.`)) return
    const res = await fetch(`/api/siswa/${id}`, { method: 'DELETE' })
    const data = (await res.json()) as { error?: string }
    setPesan(res.ok ? `Data ${namaSiswa} berhasil dihapus.` : (data.error ?? 'Gagal menghapus data siswa'))
    if (res.ok) router.refresh()
  }

  const siswaTampil = filterKelas
    ? siswaList.filter((s) => s.classId === filterKelas || s.kelas === filterKelas)
    : siswaList

  return (
    <div className="space-y-3">
      {/* Form Edit Modal / Card */}
      {editSiswa && (
        <section className="rounded-2xl border-2 border-aksen bg-kartu p-5 shadow-bento">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Ubah Data Siswa ({editSiswa.nisn})</h2>
            <button
              type="button"
              onClick={() => setEditSiswa(null)}
              className="text-xs text-teks-2 hover:underline"
            >
              Tutup
            </button>
          </div>
          <form onSubmit={simpanEdit} className="mt-3 grid gap-2 md:grid-cols-3">
            <input
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              placeholder="Nama lengkap"
              required
              className="rounded-xl border border-garis px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={editClassId}
              onChange={(e) => setEditClassId(e.target.value)}
              required
              className="rounded-xl border border-garis px-3 py-2 text-sm"
            >
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-aksen px-5 py-2 text-xs font-bold text-gelap disabled:opacity-60"
              >
                {loading ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
              <button
                type="button"
                onClick={() => setEditSiswa(null)}
                className="rounded-full border border-garis px-4 py-2 text-xs font-semibold text-teks-2"
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Tambah Murid */}
      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">Tambah murid</h2>
        <p className="text-xs text-teks-2">
          Sandi awal = NISN. Siswa wajib ganti sandi saat login pertama.
        </p>

        <form onSubmit={tambah} className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={nisn}
            onChange={(e) => setNisn(e.target.value)}
            placeholder="NISN"
            required
            inputMode="numeric"
            className="rounded-xl border border-garis px-3 py-2 text-sm"
          />
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama lengkap"
            required
            className="rounded-xl border border-garis px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            required
            className="rounded-xl border border-garis px-3 py-2 text-sm"
          >
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading || kelasList.length === 0}
            className="rounded-full bg-aksen px-4 py-2 text-sm font-bold text-gelap disabled:opacity-60 md:col-span-1"
          >
            {loading ? 'Menyimpan…' : '+ Tambah Murid'}
          </button>

          <label className="md:col-span-3">
            <span className="text-xs font-semibold text-teks-2">
              atau unggah Excel (.xlsx, kolom nisn/nama/kelas)
            </span>
            <input
              ref={berkasRef}
              type="file"
              accept=".xlsx"
              onChange={unggah}
              className="mt-1 block w-full text-xs"
            />
          </label>
        </form>

        {kelasList.length === 0 && (
          <p className="mt-2 text-xs text-izin">Anda belum mengampu kelas mana pun. Silakan tambahkan jadwal atau mata pelajaran terlebih dahulu.</p>
        )}
        {pesan && <p className="mt-2 text-xs text-teks">{pesan}</p>}
      </section>

      {/* Tabel Murid & Filter Kelas */}
      <section className="overflow-x-auto rounded-2xl bg-kartu shadow-bento">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis p-4">
          <div>
            <h3 className="text-sm font-semibold">Daftar Siswa</h3>
            <p className="text-xs text-teks-2">Menampilkan {siswaTampil.length} siswa</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-kelas-select" className="text-xs font-semibold text-teks-2">Filter Kelas:</label>
            <select
              id="filter-kelas-select"
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="rounded-xl border border-garis bg-kartu px-3 py-1.5 text-xs font-medium"
            >
              <option value="">Semua Kelas ({siswaList.length})</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">NISN</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Kunci HP</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {siswaTampil.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-teks-2">
                  Belum ada siswa di kelas ini.
                </td>
              </tr>
            )}
            {siswaTampil.map((s) => (
              <tr key={s.id} className="border-t border-garis">
                <td className="px-4 py-2.5 font-medium">{s.nama}</td>
                <td className="tabular px-4 py-2.5 text-xs text-teks-2">{s.nisn}</td>
                <td className="px-4 py-2.5 text-xs">{s.kelas}</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className={s.terkunci ? 'text-hadir font-semibold' : 'text-teks-2'}>
                    {s.terkunci ? 'terkunci' : 'belum'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => mulaiEdit(s)}
                      className="text-xs font-semibold text-teks underline hover:text-hadir"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => resetDevice(s.id, s.nama)}
                      className="text-xs font-semibold text-teks-2 underline hover:text-teks"
                    >
                      Reset Kunci HP
                    </button>
                    <button
                      type="button"
                      onClick={() => hapus(s.id, s.nama)}
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
