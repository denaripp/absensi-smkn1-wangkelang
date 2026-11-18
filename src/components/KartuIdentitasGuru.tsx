export default function KartuIdentitasGuru({
  nama,
  nip,
  jurusan,
  jumlahMapel,
  kelasAktif,
}: {
  nama: string
  nip: string
  jurusan: string
  jumlahMapel: number
  kelasAktif: string | null
}) {
  return (
    <section className="rounded-2xl bg-gelap p-5 text-white shadow-bento">
      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
        Guru Pengampu
      </span>

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/50">
        Nomor Induk Pegawai
      </p>
      <p className="tabular text-sm font-semibold">{nip}</p>

      <p className="mt-3 text-lg font-bold leading-tight">{nama}</p>
      <p className="text-xs text-white/60">{jurusan}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-aksen px-3 py-1 text-[11px] font-bold text-gelap">
          {jumlahMapel} mapel diampu
        </span>
        {kelasAktif && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold">
            {kelasAktif}
          </span>
        )}
      </div>
    </section>
  )
}
