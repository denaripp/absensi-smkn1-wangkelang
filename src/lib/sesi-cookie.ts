import { createHmac, timingSafeEqual } from 'node:crypto'

export type SesiPengguna = {
  id: string
  role: 'GURU' | 'SISWA'
  mustChange: boolean
  nama: string
  nip: string
  exp: number
}

const TUJUH_HARI_DETIK = 7 * 24 * 60 * 60

function rahasia() {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET belum diset')
  return secret
}

function buatSig(payloadBase64: string): string {
  return createHmac('sha256', rahasia()).update(payloadBase64).digest('base64url')
}

export function buatSesiToken(
  data: Omit<SesiPengguna, 'exp'>,
  durasiDetik = TUJUH_HARI_DETIK,
): string {
  const payload: SesiPengguna = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + durasiDetik,
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = buatSig(payloadStr)
  return `${payloadStr}.${sig}`
}

export function verifikasiSesiToken(token?: string | null): SesiPengguna | null {
  if (!token || typeof token !== 'string') return null
  const bagian = token.split('.')
  if (bagian.length !== 2) return null

  const [payloadStr, kirimSig] = bagian
  if (!payloadStr || !kirimSig) return null

  try {
    const harapSig = Buffer.from(buatSig(payloadStr))
    const sigBuffer = Buffer.from(kirimSig)
    if (harapSig.length !== sigBuffer.length || !timingSafeEqual(harapSig, sigBuffer)) {
      return null
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8')) as SesiPengguna
    if (!payload.id || !payload.role || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}
