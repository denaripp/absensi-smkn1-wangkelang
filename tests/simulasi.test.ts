import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.QR_HMAC_SECRET = 'kunci-uji-simulasi-1234567890'

const { buatToken, verifikasiToken } = await import('../src/lib/qr.ts')
const { tanggalWIB } = await import('../src/lib/format.ts')

test('token simulasi sesi valid di bucket sekarang', () => {
  const sessionId = 'sesi-simulasi-123'
  const { token, expiresInMs } = buatToken(sessionId)
  assert.ok(token)
  assert.ok(expiresInMs > 0 && expiresInMs <= 15_000)

  const terverifikasi = verifikasiToken(token)
  assert.equal(terverifikasi?.sessionId, sessionId)
})

test('format tanggal sesi simulasi sesuai zona WIB (YYYY-MM-DD)', () => {
  const tgl = tanggalWIB(new Date())
  assert.match(tgl, /^\d{4}-\d{2}-\d{2}$/)
})

test('token simulasi dengan sesi berbeda tidak tertukar', () => {
  const { token: token1 } = buatToken('sesi-a')
  const { token: token2 } = buatToken('sesi-b')

  const res1 = verifikasiToken(token1)
  const res2 = verifikasiToken(token2)

  assert.equal(res1?.sessionId, 'sesi-a')
  assert.equal(res2?.sessionId, 'sesi-b')
  assert.notEqual(token1, token2)
})
