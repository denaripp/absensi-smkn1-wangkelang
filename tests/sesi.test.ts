import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.QR_HMAC_SECRET = 'kunci-uji-sesi-1234567890'

const { buatSesiToken, verifikasiSesiToken } = await import('../src/lib/sesi-cookie.ts')

test('token sesi valid didekode dengan benar', () => {
  const token = buatSesiToken({
    id: 'user-1',
    role: 'GURU',
    mustChange: false,
    nama: 'Rahmat Hidayat',
    nip: '198705122010011004',
  })
  const hasil = verifikasiSesiToken(token)
  assert.equal(hasil?.id, 'user-1')
  assert.equal(hasil?.role, 'GURU')
  assert.equal(hasil?.mustChange, false)
  assert.equal(hasil?.nama, 'Rahmat Hidayat')
  assert.equal(hasil?.nip, '198705122010011004')
})

test('token kedaluwarsa ditolak', () => {
  // Durasi negatif -> langsung expired
  const token = buatSesiToken(
    {
      id: 'user-2',
      role: 'SISWA',
      mustChange: true,
      nama: 'Ahmad',
      nip: '0061234501',
    },
    -10,
  )
  const hasil = verifikasiSesiToken(token)
  assert.equal(hasil, null)
})

test('token dengan signature diubah ditolak', () => {
  const token = buatSesiToken({
    id: 'user-3',
    role: 'GURU',
    mustChange: false,
    nama: 'Guru',
    nip: '123',
  })
  const palsu = token.slice(0, -3) + 'xyz'
  assert.equal(verifikasiSesiToken(palsu), null)
})

test('token format rusak ditolak tanpa exception', () => {
  assert.equal(verifikasiSesiToken(''), null)
  assert.equal(verifikasiSesiToken(null), null)
  assert.equal(verifikasiSesiToken('bukan-token'), null)
  assert.equal(verifikasiSesiToken('a.b.c'), null)
})
