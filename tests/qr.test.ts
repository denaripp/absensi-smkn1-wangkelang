import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.QR_HMAC_SECRET = 'rahasia-uji'
const { buatToken, verifikasiToken, BUCKET_MS } = await import('../src/lib/qr.ts')

const T0 = 1_000_000_000_000
const T_AWAL_BUCKET = Math.floor(T0 / 15000) * 15000 // tepat di awal bucket, biar hitungan grace tidak ambigu

test('token valid di bucket sekarang', () => {
  const { token } = buatToken('sesi-1', T0)
  assert.deepEqual(verifikasiToken(token, T0), { sessionId: 'sesi-1', bucket: 66666666 })
})

test('expiresInMs sisa waktu dalam bucket', () => {
  const { expiresInMs } = buatToken('sesi-1', T0)
  assert.ok(expiresInMs > 0 && expiresInMs <= BUCKET_MS)
})

test('token ditolak setelah 2 bucket (30 detik lebih)', () => {
  const { token } = buatToken('sesi-1', T0)
  assert.equal(verifikasiToken(token, T0 + 31_000), null)
})

test('token masih diterima pada bucket berikutnya (toleransi 15 detik)', () => {
  const { token } = buatToken('sesi-1', T_AWAL_BUCKET)
  assert.deepEqual(verifikasiToken(token, T_AWAL_BUCKET + 20_000), {
    sessionId: 'sesi-1',
    bucket: Math.floor(T_AWAL_BUCKET / 15000),
  })
})

test('token dengan tanda tangan diubah ditolak', () => {
  const { token } = buatToken('sesi-1', T0)
  const rusak = `${token.slice(0, -2)}zz`
  assert.equal(verifikasiToken(rusak, T0), null)
})

test('session id ditukar tanpa tanda tangan baru ditolak', () => {
  const { token } = buatToken('sesi-A', T0)
  const [, bucket, tanda] = token.split('.')
  assert.equal(verifikasiToken(`sesi-B.${bucket}.${tanda}`, T0), null)
})

test('format token ngawur ditolak tanpa melempar error', () => {
  assert.equal(verifikasiToken('', T0), null)
  assert.equal(verifikasiToken('a.b', T0), null)
  assert.equal(verifikasiToken('a.bukan-angka.c', T0), null)
})
