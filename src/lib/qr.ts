import { createHmac, timingSafeEqual } from 'node:crypto'

export const BUCKET_MS = 15_000

function sig(payload: string) {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET belum diset')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function buatToken(sessionId: string, now = Date.now()) {
  const bucket = Math.floor(now / BUCKET_MS)
  const payload = `${sessionId}.${bucket}`
  return { token: `${payload}.${sig(payload)}`, expiresInMs: BUCKET_MS - (now % BUCKET_MS) }
}

export function verifikasiToken(token: string, now = Date.now()) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [sessionId, bucketStr, tanda] = parts
  const bucket = Number(bucketStr)
  if (!sessionId || !Number.isInteger(bucket)) return null
  const sekarang = Math.floor(now / BUCKET_MS)
  // toleransi satu bucket (15 detik) untuk jeda jaringan + waktu baca kamera
  if (bucket < sekarang - 1 || bucket > sekarang) return null
  const harap = Buffer.from(sig(`${sessionId}.${bucket}`))
  const kirim = Buffer.from(tanda)
  if (harap.length !== kirim.length || !timingSafeEqual(harap, kirim)) return null
  return { sessionId, bucket }
}
