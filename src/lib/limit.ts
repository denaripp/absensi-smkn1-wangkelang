// Pembatas laju sederhana, per proses. Cukup untuk satu instance/sekolah.
// shortcut: memori per-instance, tanpa Redis — kalau nanti jalan multi-instance, pindahkan ke tabel/Upstash.
type Catatan = { jumlah: number; resetPada: number }

const peta = new Map<string, Catatan>()

export type HasilBatas = { boleh: boolean; sisa: number; tungguDetik: number }

export function batasi(kunci: string, maks: number, jendelaMs: number, sekarang = Date.now()): HasilBatas {
  if (peta.size > 5000) {
    for (const [k, v] of peta) if (v.resetPada < sekarang) peta.delete(k)
  }

  const catatan = peta.get(kunci)

  if (!catatan || catatan.resetPada < sekarang) {
    peta.set(kunci, { jumlah: 1, resetPada: sekarang + jendelaMs })
    return { boleh: true, sisa: maks - 1, tungguDetik: 0 }
  }

  catatan.jumlah += 1

  if (catatan.jumlah > maks) {
    return { boleh: false, sisa: 0, tungguDetik: Math.max(1, Math.ceil((catatan.resetPada - sekarang) / 1000)) }
  }

  return { boleh: true, sisa: maks - catatan.jumlah, tungguDetik: 0 }
}

export function ipDari(request: Request) {
  const h = request.headers
  const maju = h.get('x-forwarded-for')
  if (maju) return maju.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'lokal'
}

export function kosongkanBatas() {
  peta.clear()
}
