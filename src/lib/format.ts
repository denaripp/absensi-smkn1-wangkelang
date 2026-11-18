const WIB = 'Asia/Jakarta'

export function jamWIB(waktu: Date | string) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: WIB,
  }).format(new Date(waktu))
}

export function tanggalPanjangWIB(waktu: Date | string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: WIB,
  }).format(new Date(waktu))
}

// YYYY-MM-DD menurut zona sekolah, bukan zona server.
export function tanggalWIB(waktu: Date | string = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: WIB }).format(new Date(waktu))
}

export function sapaanWIB(waktu: Date | string = new Date()) {
  const jam = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: WIB }).format(
      new Date(waktu),
    ),
  )
  if (jam < 11) return 'Selamat Pagi'
  if (jam < 15) return 'Selamat Siang'
  if (jam < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

// Dipakai Server Component: Date.now() tidak boleh dipanggil langsung di badan render.
export function tanggalTujuhHariLaluWIB() {
  return tanggalWIB(new Date(Date.now() - 6 * 86_400_000))
}
