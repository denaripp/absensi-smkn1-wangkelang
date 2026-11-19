import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const classId = typeof body.classId === 'string' ? body.classId : ''
  const subjectId = typeof body.subjectId === 'string' ? body.subjectId : ''
  const dayOfWeek = typeof body.dayOfWeek === 'number' ? body.dayOfWeek : Number(body.dayOfWeek)
  const jamKe = typeof body.jamKe === 'number' ? body.jamKe : Number(body.jamKe)
  const jamMulai = typeof body.jamMulai === 'string' ? body.jamMulai.trim() : ''
  const jamSelesai = typeof body.jamSelesai === 'string' ? body.jamSelesai.trim() : ''

  if (!classId || !subjectId) return tolak('kelas dan mata pelajaran wajib dipilih', 400)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6) {
    return tolak('hari harus antara 1 (Senin) sampai 6 (Sabtu)', 400)
  }
  if (!Number.isInteger(jamKe) || jamKe < 1 || jamKe > 12) {
    return tolak('jam ke harus antara 1 sampai 12', 400)
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(jamMulai) || !/^\d{2}:\d{2}(:\d{2})?$/.test(jamSelesai)) {
    return tolak('format jam harus HH:mm (contoh 07:00)', 400)
  }
  if (jamSelesai <= jamMulai) {
    return tolak('jam selesai harus lebih besar dari jam mulai', 400)
  }

  const admin = createAdminClient()

  // Verifikasi mapel milik guru
  const { data: mapel } = await admin
    .from('teacher_subjects')
    .select('id')
    .eq('id', subjectId)
    .eq('teacher_id', profil.id)
    .maybeSingle()
  if (!mapel) return tolak('mata pelajaran bukan milikmu', 403)

  // Verifikasi kelas ada
  const { data: kelas } = await admin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .maybeSingle()
  if (!kelas) return tolak('kelas tidak ditemukan', 404)

  const { data: baru, error } = await admin
    .from('schedules')
    .insert({
      class_id: classId,
      subject_id: subjectId,
      day_of_week: dayOfWeek,
      jam_ke: jamKe,
      jam_mulai: jamMulai.length === 5 ? `${jamMulai}:00` : jamMulai,
      jam_selesai: jamSelesai.length === 5 ? `${jamSelesai}:00` : jamSelesai,
    })
    .select('id')
    .single()

  if (error?.code === '23505') {
    return tolak('jadwal di kelas, hari, dan jam ke tersebut sudah ada', 409)
  }
  if (error) return tolak('gagal menambah jadwal: ' + error.message, 500)

  return NextResponse.json({ ok: true, id: baru.id })
}
