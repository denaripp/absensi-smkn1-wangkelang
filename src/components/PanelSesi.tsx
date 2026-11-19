'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useKehadiranLive } from '@/hooks/useKehadiranLive'
import WidgetSiswaBaruHadir from '@/components/WidgetSiswaBaruHadir'

type Sesi = { id: string; mapel: string; kelas: string; mulai: string }
type Pilihan = { id: string; nama: string }
type Siswa = { id: string; nama: string; nisn: string }

const LABEL: Record<string, string> = {
  HADIR: 'Hadir',
  HADIR_MANUAL: 'Hadir manual',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  ALPA: 'Alpa',
}

export default function PanelSesi({
  sesi,
  mapelList,
  kelasList,
  roster,
  statusAwal,
}: {
  sesi: Sesi | null
  mapelList: Pilihan[]
  kelasList: Pilihan[]
  roster: Siswa[]
  statusAwal: Record<string, string>
}) {
  const router = useRouter()
  const [subjectId, setSubjectId] = useState(mapelList[0]?.id ?? '')
  const [classId, setClassId] = useState(kelasList[0]?.id ?? '')
  const [pesan, setPesan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [sisa, setSisa] = useState(0)

  const status = useKehadiranLive(sesi?.id ?? null, statusAwal)

  useEffect(() => {
    if (!sesi) return
    let batal = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function ambilToken() {
      const res = await fetch(`/api/qr?sessionId=${sesi?.id}`, { cache: 'no-store' })
      if (!res.ok || batal) return
      const data = (await res.json()) as { token?: string; expiresInMs?: number }
      if (batal || !data.token) return
      setToken(data.token)
      setSisa(Math.ceil((data.expiresInMs ?? 15_000) / 1000))
      timer = setTimeout(ambilToken, data.expiresInMs ?? 15_000)
    }

    ambilToken()
    return () => {
      batal = true
      if (timer) clearTimeout(timer)
    }
  }, [sesi])

  useEffect(() => {
    if (!sesi) return
    const jam = setInterval(() => setSisa((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => clearInterval(jam)
  }, [sesi])

  const metrik = useMemo(() => {
    let hadir = 0
    let sakit = 0
    let izin = 0
    let alpa = 0
    for (const s of roster) {
      const st = status[s.id]
      if (st === 'HADIR' || st === 'HADIR_MANUAL') hadir += 1
      else if (st === 'SAKIT') sakit += 1
      else if (st === 'IZIN') izin += 1
      else if (st === 'ALPA') alpa += 1
    }
    return { hadir, sakit, izin, alpa }
  }, [roster, status])

  async function bukaSesi() {
    setLoading(true)
    setPesan(null)
    const res = await fetch('/api/sesi/buka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectId, classId }),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)
    if (!res.ok) {
      setPesan(data.error ?? 'gagal membuka sesi')
      return
    }
    router.refresh()
  }

  async function tutupSesi() {
    if (!sesi) return
    setLoading(true)
    setPesan(null)
    const res = await fetch('/api/sesi/tutup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sesi.id }),
    })
    const data = (await res.json()) as { error?: string; alpa?: number }
    setLoading(false)
    if (!res.ok) {
      setPesan(data.error ?? 'gagal menutup sesi')
      return
    }
    setPesan(`Sesi ditutup. ${data.alpa ?? 0} siswa ditandai Alpa.`)
    router.refresh()
  }

  async function ubahStatus(studentId: string, nilai: string) {
    if (!sesi || !nilai) return
    const res = await fetch('/api/sesi/manual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sesi.id, studentId, status: nilai }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      setPesan(data.error ?? 'gagal menyimpan status')
      return
    }
    router.refresh()
  }

  const belumAdaData = mapelList.length === 0 || kelasList.length === 0

  return (
    <section className="rounded-2xl bg-kartu p-5 shadow-bento">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
              sesi ? 'bg-aksen-lembut text-gelap' : 'bg-kanvas text-teks-2'
            }`}
          >
            {sesi ? 'Sesi Aktif' : 'Belum ada sesi'}
          </span>
          <h2 className="mt-3 text-lg font-bold leading-tight">
            {sesi ? sesi.mapel : 'Buka sesi presensi'}
          </h2>
          <p className="text-xs text-teks-2">
            {sesi ? `${sesi.kelas} • dibuka ${sesi.mulai}` : 'Pilih mata pelajaran dan kelas, lalu munculkan QR.'}
          </p>
        </div>
        <p className="tabular text-sm font-semibold text-teks-2">
          {sesi ? `${metrik.hadir}/${roster.length} sudah absen` : `${roster.length || 0} siswa terdaftar`}
        </p>
      </header>

      {!sesi && (
        <div className="mt-4 space-y-3">
          {belumAdaData ? (
            <p className="rounded-xl bg-kanvas px-4 py-3 text-sm text-teks-2">
              {mapelList.length === 0
                ? 'Belum ada mata pelajaran yang kamu ampu. Tambah lewat menu Mapel.'
                : 'Belum ada kelas di sekolah. Tambah lewat menu Kelas.'}
            </p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-teks-2">
                  Mata pelajaran
                </span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-garis bg-kartu px-4 py-3 text-sm"
                >
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-teks-2">Kelas</span>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-garis bg-kartu px-4 py-3 text-sm"
                >
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={bukaSesi}
                disabled={loading}
                className="w-full rounded-full bg-aksen px-4 py-3 text-sm font-bold text-gelap hover:bg-aksen-hover disabled:opacity-60"
              >
                {loading ? 'Membuka…' : 'Munculkan QR Code'}
              </button>
            </>
          )}
        </div>
      )}

      {sesi && (
        <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
          <div className="rounded-2xl border border-garis p-4 text-center">
            <div className="mx-auto grid size-[200px] place-items-center rounded-xl bg-white">
              {token ? (
                <QRCodeSVG value={token} size={180} level="M" />
              ) : (
                <span className="text-xs text-teks-2">memuat QR…</span>
              )}
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-teks-2">
              Scan via HP Siswa
            </p>
            <p className="text-[11px] text-teks-2">Token bergulir otomatis tiap 15 detik.</p>
            <p className="tabular mt-1 text-sm font-bold">{String(sisa).padStart(2, '0')} detik</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-garis">
              <div
                className="h-full rounded-full bg-aksen transition-all duration-500"
                style={{ width: `${(sisa / 15) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Hadir', nilai: metrik.hadir, warna: 'text-hadir', bg: 'bg-[#DCFCE7]' },
              { label: 'Sakit', nilai: metrik.sakit, warna: 'text-sakit', bg: 'bg-[#F3E8FF]' },
              { label: 'Izin', nilai: metrik.izin, warna: 'text-izin', bg: 'bg-[#FEF3C7]' },
              { label: 'Alpa', nilai: metrik.alpa, warna: 'text-alpa', bg: 'bg-[#FEE2E2]' },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-kanvas p-4">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${m.bg} ${m.warna}`}>
                  {m.label}
                </span>
                <p className={`tabular mt-2 text-3xl font-black ${m.warna}`}>{m.nilai}</p>
                <p className="text-[11px] text-teks-2">siswa</p>
              </div>
            ))}
          </div>
          <div className="md:col-span-2">
            <WidgetSiswaBaruHadir roster={roster} status={status} />
          </div>
        </div>
      )}

      {pesan && (
        <p role="status" className="mt-3 rounded-xl bg-kanvas px-4 py-3 text-sm text-teks">
          {pesan}
        </p>
      )}

      {sesi && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={tutupSesi}
              disabled={loading}
              className="rounded-full bg-gelap px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Tutup Sesi
            </button>
            <a
              href={`/api/qr?sessionId=${sesi.id}`}
              className="rounded-full border border-garis px-4 py-2.5 text-sm font-semibold text-teks"
              title="Token mentah untuk uji tanpa kamera"
              target="_blank"
              rel="noreferrer"
            >
              Lihat token
            </a>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-garis">
            <table className="w-full text-left text-sm">
              <thead className="bg-kanvas text-[11px] uppercase tracking-wide text-teks-2">
                <tr>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">NISN</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ubah</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-teks-2">
                      Belum ada siswa di kelas ini.
                    </td>
                  </tr>
                )}
                {roster.map((s) => {
                  const st = status[s.id]
                  return (
                    <tr key={s.id} className="border-t border-garis">
                      <td className={`px-3 py-2 font-medium ${st === 'HADIR' || st === 'HADIR_MANUAL' ? 'text-hadir' : ''}`}>
                        {s.nama}
                      </td>
                      <td className="tabular px-3 py-2 text-xs text-teks-2">{s.nisn}</td>
                      <td className="px-3 py-2 text-xs font-semibold">
                        <span
                          className={
                            st === 'HADIR' || st === 'HADIR_MANUAL'
                              ? 'text-hadir'
                              : st === 'SAKIT'
                                ? 'text-sakit'
                                : st === 'IZIN'
                                  ? 'text-izin'
                                  : st === 'ALPA'
                                    ? 'text-alpa'
                                    : 'text-teks-2'
                          }
                        >
                          {st ? LABEL[st] : 'belum absen'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Ubah status ${s.nama}`}
                          value={st ?? ''}
                          onChange={(e) => ubahStatus(s.id, e.target.value)}
                          className="rounded-lg border border-garis bg-kartu px-2 py-1 text-xs"
                        >
                          <option value="">—</option>
                          <option value="HADIR_MANUAL">Hadir manual</option>
                          <option value="SAKIT">Sakit</option>
                          <option value="IZIN">Izin</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
