import { test } from 'node:test'
import assert from 'node:assert/strict'

const { batasi, kosongkanBatas } = await import('../src/lib/limit.ts')

const JENDELA = 60_000

test('permintaan di bawah batas diterima', () => {
  kosongkanBatas()
  const t0 = 1_000_000
  for (let i = 0; i < 3; i += 1) {
    assert.equal(batasi('kunci-a', 3, JENDELA, t0).boleh, true)
  }
  assert.equal(batasi('kunci-a', 3, JENDELA, t0).boleh, false)
})

test('kunci berbeda tidak saling memblokir', () => {
  kosongkanBatas()
  const t0 = 2_000_000
  assert.equal(batasi('guru', 1, JENDELA, t0).boleh, true)
  assert.equal(batasi('siswa', 1, JENDELA, t0).boleh, true)
  assert.equal(batasi('guru', 1, JENDELA, t0).boleh, false)
})

test('batas pulih setelah jendela lewat', () => {
  kosongkanBatas()
  const t0 = 3_000_000
  assert.equal(batasi('kunci-b', 1, JENDELA, t0).boleh, true)
  assert.equal(batasi('kunci-b', 1, JENDELA, t0 + JENDELA + 1).boleh, true)
})

test('tungguDetik masuk akal saat diblokir', () => {
  kosongkanBatas()
  const t0 = 4_000_000
  batasi('kunci-c', 1, JENDELA, t0)
  const hasil = batasi('kunci-c', 1, JENDELA, t0 + 1000)
  assert.equal(hasil.boleh, false)
  assert.ok(hasil.tungguDetik >= 58 && hasil.tungguDetik <= 60, `tungguDetik=${hasil.tungguDetik}`)
})
