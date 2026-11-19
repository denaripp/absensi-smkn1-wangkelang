'use client'

import { useState } from 'react'

type Kelas = { id: string; nama: string }
type Mapel = { id: string; nama: string }

export default function PanelRekap({
  kelasList,
  mapelList,
  bawalDari,
  bawalSampai,
}: {
  kelasList: Kelas[]
  mapelList: Mapel[]
  bawalDari: string
  bawalSampai: string
}) {
  const [classId, setClassId] = useState(kelasList[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState('')
  const [dari, setDari] = useState(bawalDari)
  const [sampai, setSampai] = useState(bawalSampai)

  const siap = Boolean(classId && dari && sampai)

  return (
    <section className="rounded-2xl bg-kartu p-5 shadow-bento">
      <h2 className="text-base font-semibold">Filter laporan</h2>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <label className="text-xs">
          <span className="font-semibold text-teks-2">Kelas</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
          >
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="font-semibold text-teks-2">Mata pelajaran (opsional)</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
          >
            <option value="">Semua mapel</option>
            {mapelList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="font-semibold text-teks-2">Dari</span>
          <input
            type="date"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
            className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
          />
        </label>

        <label className="text-xs">
          <span className="font-semibold text-teks-2">Sampai</span>
          <input
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            className="mt-1 w-full rounded-xl border border-garis px-3 py-2 text-sm"
          />
        </label>
      </div>

      <a
        href={
          siap
            ? `/api/rekap/export?classId=${classId}&dari=${dari}&sampai=${sampai}${subjectId ? `&subjectId=${subjectId}` : ''}`
            : '#'
        }
        aria-disabled={!siap}
        onClick={(e) => {
          if (!siap) e.preventDefault()
        }}
        className={`mt-4 inline-block rounded-full px-4 py-2.5 text-sm font-bold transition ${
          siap ? 'bg-aksen text-gelap hover:brightness-105' : 'cursor-not-allowed bg-kanvas text-teks-2'
        }`}
      >
        Unduh Laporan Excel (.xlsx)
      </a>
      {!siap && <p className="mt-1 text-xs text-teks-2">Pilih kelas serta tentukan tanggal awal dan akhir untuk mengunduh laporan.</p>}
    </section>
  )
}
