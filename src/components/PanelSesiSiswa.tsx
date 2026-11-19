'use client'

import { useState } from 'react'
import ScannerQR from '@/components/ScannerQR'
import KontrolSimulasiSiswa from '@/components/KontrolSimulasiSiswa'
import { useSesiAktif } from '@/hooks/useSesiAktif'

export default function PanelSesiSiswa({
  classId,
  sesi,
  sudahAbsen = false,
  statusAbsen = null,
}: {
  classId: string | null
  sesi: { id: string; mapel: string; guru: string; mulai: string } | null
  sudahAbsen?: boolean
  statusAbsen?: string | null
}) {
  const [buka, setBuka] = useState(false)
  useSesiAktif(classId)

  if (!sesi) {
    return (
      <section className="rounded-2xl bg-kartu p-5 shadow-bento">
        <span className="rounded-full bg-kanvas px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-teks-2">
          Sesi Kelas
        </span>
        <h2 className="mt-3 text-base font-semibold">Belum ada sesi absensi aktif untuk kelasmu</h2>
        <p className="mt-1 text-xs text-teks-2">
          Kartu ini menyala sendiri begitu guru membuka sesi. Kamu tidak perlu memuat ulang halaman.
        </p>

        <KontrolSimulasiSiswa
          adaSesi={false}
          sudahAbsen={false}
        />
      </section>
    )
  }

  return (
    <>
      <section className="rounded-2xl bg-aksen p-5 shadow-bento">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-gelap px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Sesi Aktif
          </span>
          <span className="text-[11px] font-semibold text-gelap/70">dibuka {sesi.mulai}</span>
        </div>

        <h2 className="mt-3 text-xl font-black leading-tight text-gelap">{sesi.mapel}</h2>
        <p className="text-xs font-medium text-gelap/70">Guru pengampu: {sesi.guru}</p>

        {!sudahAbsen ? (
          <>
            <button
              type="button"
              onClick={() => setBuka(true)}
              className="mt-4 w-full rounded-full bg-gelap px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-black/80 active:scale-95"
            >
              Buka Kamera &amp; Scan QR
            </button>
            <p className="mt-2 text-center text-[11px] text-gelap/70">
              QR berganti tiap 15 detik. Tanpa selfie, tanpa titip absen.
            </p>
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-gelap/10 p-3 text-center">
            <p className="text-sm font-bold text-gelap">
              ✓ Kamu sudah presensi ({statusAbsen ?? 'Hadir'}) pada sesi ini
            </p>
          </div>
        )}

        <KontrolSimulasiSiswa
          adaSesi={true}
          sudahAbsen={sudahAbsen}
          statusAbsen={statusAbsen}
        />
      </section>

      {buka && <ScannerQR onTutup={() => setBuka(false)} />}
    </>
  )
}
