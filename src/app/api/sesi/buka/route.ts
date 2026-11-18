import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 })
  }

  const subjectId = String(body.subjectId ?? '')
  const classId = String(body.classId ?? '')
  if (!subjectId || !classId) {
    return NextResponse.json({ error: 'mata pelajaran dan kelas wajib dipilih' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: mapel } = await admin
    .from('teacher_subjects')
    .select('id')
    .eq('id', subjectId)
    .eq('teacher_id', profil.id)
    .maybeSingle()
  if (!mapel) return NextResponse.json({ error: 'mata pelajaran bukan milikmu' }, { status: 403 })

  const { data: kelas } = await admin.from('classes').select('id').eq('id', classId).maybeSingle()
  if (!kelas) return NextResponse.json({ error: 'kelas tidak ditemukan' }, { status: 404 })

  const { data: sesi, error } = await admin
    .from('sessions')
    .insert({ teacher_id: profil.id, class_id: classId, subject_id: subjectId })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const pesan = error.message.includes('sessions_satu_aktif_per_kelas')
        ? 'masih ada sesi aktif di kelas ini, tutup dulu'
        : 'sesi mapel ini sudah dibuka hari ini'
      return NextResponse.json({ error: pesan }, { status: 409 })
    }
    return NextResponse.json({ error: 'gagal membuka sesi' }, { status: 500 })
  }

  return NextResponse.json({ sessionId: sesi.id })
}
