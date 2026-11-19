'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mapel = { id: string; nama: string; jumlahSesi: number }
type Kelas = { id: string; nama: string }
type Jadwal = {
  id: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
  dayOfWeek: number
  jamKe: number
  jamMulai: string
  jamSelesai: string
}

const HARI = [
  { val: 1, nama: 'Senin' },
  { val: 2, nama: 'Selasa' },
  { val: 3, nama: 'Rabu' },
  { val: 4, nama: 'Kamis' },
  { val: 5, nama: 'Jumat' },
  { val: 6, nama: 'Sabtu' },
]

export default function PanelMapel({
  mapelList,
  kelasList,
  jadwalList = [],
}: {
  mapelList: Mapel[]
  kelasList: Kelas[]
  jadwalList?: Jadwal[]
}) {
  const router = useRouter()
  // State Mapel
  const [nama, setNama] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [pesanMapel, setPesanMapel] = useState<string | null>(null)
  const [loadingMapel, setLoadingMapel] = useState(false)

  // State Jadwal
  const [jSubjectId, setJSubjectId] = useState(mapelList[0]?.id ?? '')
  const [jClassId, setJClassId] = useState(kelasList[0]?.id ?? '')
  const [jDay, setJDay] = useState(1)
  const [jJamKe, setJJamKe] = useState(1)
  const [jJamMulai, setJJamMulai] = useState('07:00')
  const [jJamSelesai, setJJamSelesai] = useState('08:30')
  const [pesanJadwal, setPesanJadwal] = useState<string | null>(null)
  const [loadingJadwal, setLoadingJadwal] = useState(false)

  async function kirimMapel(e: React.FormEvent) {
    e.preventDefault()
    setLoadingMapel(true)
    setPesanMapel(null)

    const res = await fetch(editId ? `/api/mapel/${editId}` : '/api/mapel', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nama }),
    })
    const data = (await res.json()) as { error?: string }
    setLoadingMapel(false)

    if (!res.ok) {
      setPesanMapel(data.error ?? 'gagal menyimpan mapel')
      return
    }
    setNama('')
    setEditId(null)
    router.refresh()
  }

  async function hapusMapel(id: string) {
    if (!window.confirm('Hapus mata pelajaran ini?')) return
    const res = await fetch(`/api/mapel/${id}`, { method: 'DELETE' })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setPesanMapel(data.error ?? 'gagal menghapus')
      return
    }
    router.refresh()
  }

  async function tambahJadwal(e: React.FormEvent) {
    e.preventDefault()
    setLoadingJadwal(true)
    setPesanJadwal(null)

    const res = await fetch('/api/jadwal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subjectId: jSubjectId || mapelList[0]?.id,
        classId: jClassId || kelasList[0]?.id,
        dayOfWeek: Number(jDay),
        jamKe: Number(jJamKe),
        jamMulai: jJamMulai,
        jamSelesai: jJamSelesai,
      }),
    })
    const data = (await res.json()) as { error?: string }
    setLoadingJadwal(false)

    if (!res.ok) {
      setPesanJadwal(data.error ?? 'gagal menambah jadwal')
      return
    }
    setPesanJadwal('Jadwal berhasil ditambahkan.')
    router.refresh()
  }

  async function hapusJadwal(id: string) {
    if (!window.confirm('Hapus jadwal pelajaran ini?')) return
    const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setPesanJadwal(data.error ?? 'gagal menghapus jadwal')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Bagian 1: Kelola Mapel */}
      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">
          {editId ? 'Ubah mapel' : 'Tambah mata pelajaran'}
        </h2>
        <form onSubmit={kirimMapel} className="mt-3 flex flex-wrap gap-2">
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="cth: Basis Data"
            required
            className="min-w-[240px] flex-1 rounded-xl border border-garis px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loadingMapel}
            className="rounded-full bg-aksen px-4 py-2 text-sm font-bold text-gelap disabled:opacity-60"
          >
            {loadingMapel ? 'Menyimpan…' : editId ? 'Simpan' : 'Tambah'}
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
        {pesanMapel && <p className="mt-2 text-xs text-alpa">{pesanMapel}</p>}

        <div className="mt-4 overflow-hidden rounded-xl border border-garis">
          <table className="w-full text-left text-sm">
            <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
              <tr>
                <th className="px-4 py-2.5">Mata pelajaran</th>
                <th className="px-4 py-2.5">Sesi Berjalan</th>
                <th className="px-4 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {mapelList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-xs text-teks-2">
                    Belum ada mapel yang kamu ampu.
                  </td>
                </tr>
              )}
              {mapelList.map((m) => (
                <tr key={m.id} className="border-t border-garis">
                  <td className="px-4 py-2.5 font-medium">{m.nama}</td>
                  <td className="tabular px-4 py-2.5 text-xs text-teks-2">{m.jumlahSesi}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(m.id)
                          setNama(m.nama)
                        }}
                        className="text-xs font-semibold text-teks underline hover:text-hadir"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => hapusMapel(m.id)}
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
        </div>
      </section>

      {/* Bagian 2: Kelola Jadwal Pelajaran */}
      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <h2 className="text-base font-semibold">Jadwal Mengajar</h2>
        <p className="text-xs text-teks-2">
          Jadwal ini tampil otomatis pada kartu &quot;Jadwal Hari Ini&quot; di dashboard siswa.
        </p>

        {mapelList.length === 0 || kelasList.length === 0 ? (
          <p className="mt-3 rounded-xl bg-kanvas p-3 text-xs text-izin">
            Buat mata pelajaran dan pastikan kelas sudah tersedia sebelum menyusun jadwal.
          </p>
        ) : (
          <form onSubmit={tambahJadwal} className="mt-4 grid gap-2 md:grid-cols-6">
            <label className="text-xs md:col-span-2">
              <span className="font-semibold text-teks-2">Mata Pelajaran</span>
              <select
                value={jSubjectId}
                onChange={(e) => setJSubjectId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              >
                {mapelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs md:col-span-2">
              <span className="font-semibold text-teks-2">Kelas</span>
              <select
                value={jClassId}
                onChange={(e) => setJClassId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              >
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs md:col-span-1">
              <span className="font-semibold text-teks-2">Hari</span>
              <select
                value={jDay}
                onChange={(e) => setJDay(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              >
                {HARI.map((h) => (
                  <option key={h.val} value={h.val}>
                    {h.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs md:col-span-1">
              <span className="font-semibold text-teks-2">Jam ke-</span>
              <input
                type="number"
                min={1}
                max={12}
                value={jJamKe}
                onChange={(e) => setJJamKe(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs md:col-span-2">
              <span className="font-semibold text-teks-2">Mulai</span>
              <input
                type="time"
                value={jJamMulai}
                onChange={(e) => setJJamMulai(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs md:col-span-2">
              <span className="font-semibold text-teks-2">Selesai</span>
              <input
                type="time"
                value={jJamSelesai}
                onChange={(e) => setJJamSelesai(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-end md:col-span-2">
              <button
                type="submit"
                disabled={loadingJadwal}
                className="w-full rounded-full bg-aksen px-4 py-2 text-sm font-bold text-gelap disabled:opacity-60"
              >
                {loadingJadwal ? 'Menambah…' : '+ Tambah Jadwal'}
              </button>
            </div>
          </form>
        )}

        {pesanJadwal && <p className="mt-2 text-xs text-teks">{pesanJadwal}</p>}

        <div className="mt-4 overflow-hidden rounded-xl border border-garis">
          <table className="w-full text-left text-sm">
            <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
              <tr>
                <th className="px-4 py-2.5">Hari</th>
                <th className="px-4 py-2.5">Jam Ke</th>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5">Mata Pelajaran</th>
                <th className="px-4 py-2.5">Kelas</th>
                <th className="px-4 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jadwalList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-xs text-teks-2">
                    Belum ada jadwal mengajar.
                  </td>
                </tr>
              )}
              {jadwalList.map((j) => (
                <tr key={j.id} className="border-t border-garis">
                  <td className="px-4 py-2 font-medium">
                    {HARI.find((h) => h.val === j.dayOfWeek)?.nama ?? `Hari ${j.dayOfWeek}`}
                  </td>
                  <td className="tabular px-4 py-2 text-xs">Ke-{j.jamKe}</td>
                  <td className="tabular px-4 py-2 text-xs text-teks-2">
                    {j.jamMulai}–{j.jamSelesai}
                  </td>
                  <td className="px-4 py-2 text-xs font-semibold">{j.subjectName}</td>
                  <td className="px-4 py-2 text-xs text-teks-2">{j.className}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => hapusJadwal(j.id)}
                      className="text-xs font-semibold text-alpa underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
