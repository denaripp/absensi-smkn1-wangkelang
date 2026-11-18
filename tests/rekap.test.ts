import { test } from 'node:test'
import assert from 'node:assert/strict'

const { hitungMetrik, trenMingguan } = await import('../src/lib/rekap.ts')

test('metrik menghitung semua status', () => {
  const m = hitungMetrik([
    { status: 'HADIR' },
    { status: 'HADIR_MANUAL' },
    { status: 'SAKIT' },
    { status: 'IZIN' },
    { status: 'ALPA' },
  ])
  assert.deepEqual(m, { hadir: 2, sakit: 1, izin: 1, alpa: 1, total: 5, persen: 40 })
})

test('tanpa log: persen 0, bukan NaN', () => {
  const m = hitungMetrik([])
  assert.equal(m.total, 0)
  assert.equal(m.persen, 0)
  assert.ok(Number.isFinite(m.persen))
})

test('hadir manual dihitung hadir', () => {
  const m = hitungMetrik([{ status: 'HADIR_MANUAL' }, { status: 'ALPA' }])
  assert.equal(m.hadir, 1)
  assert.equal(m.persen, 50)
})

test('persen satu angka desimal', () => {
  const m = hitungMetrik([{ status: 'HADIR' }, { status: 'HADIR' }, { status: 'ALPA' }])
  assert.equal(m.persen, 66.7)
})

test('status tak dikenal diabaikan, tidak bikin NaN', () => {
  const m = hitungMetrik([{ status: 'HADIR' }, { status: 'NGACO' }])
  assert.equal(m.total, 1)
  assert.equal(m.persen, 100)
})

test('tren urut Senin-Jumat, Sabtu-Minggu dibuang', () => {
  const tren = trenMingguan([
    { tanggal: '2026-11-21', hadir: 30, total: 36 }, // Sabtu
    { tanggal: '2026-11-19', hadir: 34, total: 36 }, // Kamis
    { tanggal: '2026-11-22', hadir: 10, total: 36 }, // Minggu
    { tanggal: '2026-11-16', hadir: 32, total: 36 }, // Senin
  ])
  assert.deepEqual(tren, [
    { hari: 'Sen', hadir: 32, total: 36 },
    { hari: 'Kam', hadir: 34, total: 36 },
  ])
})

test('tren tanpa data mengembalikan array kosong', () => {
  assert.deepEqual(trenMingguan([]), [])
})
