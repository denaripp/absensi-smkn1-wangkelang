import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { bolehKelolaKelas } from '@/lib/otoritas'
import { jamWIB } from '@/lib/format'

export async function GET(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const url = new URL(request.url)
  const classId = url.searchParams.get('classId') ?? ''
  const subjectId = url.searchParams.get('subjectId') ?? ''
  const dari = url.searchParams.get('dari') ?? ''
  const sampai = url.searchParams.get('sampai') ?? ''

  if (!classId || !dari || !sampai) {
    return new Response(JSON.stringify({ error: 'classId, dari, sampai wajib' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const admin = createAdminClient()
  if (!(await bolehKelolaKelas(admin, profil.id, classId))) {
    return new Response(JSON.stringify({ error: 'kamu tidak mengampu kelas ini' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { data: kelas } = await admin
    .from('classes')
    .select('class_name')
    .eq('id', classId)
    .maybeSingle()

  let kueriSesi = admin
    .from('sessions')
    .select('id, session_date, subject_id')
    .eq('class_id', classId)
    .gte('session_date', dari)
    .lte('session_date', sampai)
    .order('session_date', { ascending: true })
  if (subjectId) kueriSesi = kueriSesi.eq('subject_id', subjectId)

  const { data: sesi } = await kueriSesi
  const daftarSesi = sesi ?? []
  const idSesi = daftarSesi.map((s) => s.id)

  const { data: log } = idSesi.length
    ? await admin
        .from('attendance_logs')
        .select('session_id, student_id, status, scanned_at, notes')
        .in('session_id', idSesi)
        .order('scanned_at', { ascending: true })
    : { data: [] }

  const idSiswa = [...new Set((log ?? []).map((l) => l.student_id))]
  const { data: siswa } = idSiswa.length
    ? await admin.from('users').select('id, identifier, full_name').in('id', idSiswa)
    : { data: [] }
  const petaSiswa = new Map((siswa ?? []).map((s) => [s.id, s]))

  const idMapel = [...new Set(daftarSesi.map((s) => s.subject_id))]
  const { data: mapel } = idMapel.length
    ? await admin.from('teacher_subjects').select('id, subject_name').in('id', idMapel)
    : { data: [] }
  const petaMapel = new Map((mapel ?? []).map((m) => [m.id, m.subject_name]))
  const petaSesi = new Map(daftarSesi.map((s) => [s.id, s]))

  const isi: (string | number)[][] = [
    ['No', 'Tanggal', 'Jam Scan', 'NISN', 'Nama Siswa', 'Mata Pelajaran', 'Status', 'Catatan'],
  ]

  ;(log ?? []).forEach((l, i) => {
    const s = petaSesi.get(l.session_id)
    const m = petaSiswa.get(l.student_id)
    isi.push([
      i + 1,
      s?.session_date ?? '-',
      jamWIB(l.scanned_at),
      m?.identifier ?? '-',
      m?.full_name ?? '-',
      s ? (petaMapel.get(s.subject_id) ?? '-') : '-',
      l.status,
      l.notes ?? '',
    ])
  })

  if (isi.length === 1) {
    isi.push(['-', '-', '-', '-', 'Belum ada data pada rentang tanggal ini', '-', '-', ''])
  }

  const lembar = XLSX.utils.aoa_to_sheet(isi)
  lembar['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 32 },
    { wch: 14 },
    { wch: 20 },
  ]
  const buku = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(buku, lembar, 'Rekap Absensi')
  const buffer = XLSX.write(buku, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const namaKelas = (kelas?.class_name ?? 'kelas').replace(/[^A-Za-z0-9]+/g, '-')
  const namaFile = `rekap-${namaKelas}-${dari}_${sampai}.xlsx`

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${namaFile}"`,
      'cache-control': 'no-store',
    },
  })
}
