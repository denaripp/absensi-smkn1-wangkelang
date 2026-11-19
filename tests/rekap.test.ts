import { test } from 'node:test'
import assert from 'node:assert/strict'

const { hitungMetrik, trenMingguan, hitungKehadiranPerMapel } = await import('../src/lib/rekap.ts')

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

test('hitungKehadiranPerMapel: kalkulasi kehadiran & status kelayakan akurat', () => {
  const mapelList = [
    { id: 'm1', subject_name: 'Pemrograman Web', teacher_id: 'g1' },
    { id: 'm2', subject_name: 'Basis Data', teacher_id: 'g2' },
    { id: 'm3', subject_name: 'Kewirausahaan', teacher_id: 'g1' },
  ]
  const sesiKelas = [
    { id: 's1', subject_id: 'm1' },
    { id: 's2', subject_id: 'm1' },
    { id: 's3', subject_id: 'm2' },
    { id: 's4', subject_id: 'm2' },
    { id: 's5', subject_id: 'm2' },
    { id: 's6', subject_id: 'm2' },
  ]
  const logSiswa = [
    // m1: 2 hadir dari 2 pertemuan -> 100% -> AMAN
    { session_id: 's1', status: 'HADIR' },
    { session_id: 's2', status: 'HADIR_MANUAL' },
    // m2: 3 hadir dari 4 pertemuan -> 75% -> PERINGATAN
    { session_id: 's3', status: 'HADIR' },
    { session_id: 's4', status: 'HADIR' },
    { session_id: 's5', status: 'HADIR' },
    { session_id: 's6', status: 'ALPA' },
    // m3: 0 sesi -> null persen -> BELUM_ADA_SESI
  ]
  const guruMap = new Map([
    ['g1', 'Pak Rahmat'],
    ['g2', 'Bu Siti'],
  ])

  const hasil = hitungKehadiranPerMapel({ mapelList, sesiKelas, logSiswa, guruMap })

  assert.equal(hasil.length, 3)

  // Mapel 1
  assert.equal(hasil[0].subjectName, 'Pemrograman Web')
  assert.equal(hasil[0].teacherName, 'Pak Rahmat')
  assert.equal(hasil[0].totalPertemuan, 2)
  assert.equal(hasil[0].hadir, 2)
  assert.equal(hasil[0].persen, 100)
  assert.equal(hasil[0].status, 'AMAN')

  // Mapel 2
  assert.equal(hasil[1].subjectName, 'Basis Data')
  assert.equal(hasil[1].teacherName, 'Bu Siti')
  assert.equal(hasil[1].totalPertemuan, 4)
  assert.equal(hasil[1].hadir, 3)
  assert.equal(hasil[1].alpa, 1)
  assert.equal(hasil[1].persen, 75)
  assert.equal(hasil[1].status, 'PERINGATAN')

  // Mapel 3
  assert.equal(hasil[2].subjectName, 'Kewirausahaan')
  assert.equal(hasil[2].totalPertemuan, 0)
  assert.equal(hasil[2].persen, null)
  assert.equal(hasil[2].status, 'BELUM_ADA_SESI')
})

test('hitungKehadiranPerMapel: status KRITIS saat kehadiran di bawah 75%', () => {
  const mapelList = [{ id: 'm1', subject_name: 'PBO', teacher_id: 'g1' }]
  const sesiKelas = [{ id: 's1', subject_id: 'm1' }, { id: 's2', subject_id: 'm1' }]
  const logSiswa = [
    { session_id: 's1', status: 'HADIR' },
    { session_id: 's2', status: 'ALPA' },
  ]
  const hasil = hitungKehadiranPerMapel({ mapelList, sesiKelas, logSiswa })
  assert.equal(hasil[0].persen, 50)
  assert.equal(hasil[0].status, 'KRITIS')
})
