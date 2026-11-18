import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_DIIZINKAN = ['HADIR_MANUAL', 'SAKIT', 'IZIN'] as const

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 })
  }

  const sessionId = String(body.sessionId ?? '')
  const studentId = String(body.studentId ?? '')
  const status = String(body.status ?? '')
  const notes = String(body.notes ?? '').slice(0, 200)

  if (!sessionId || !studentId) {
    return NextResponse.json({ error: 'sesi dan siswa wajib' }, { status: 400 })
  }
  if (!STATUS_DIIZINKAN.includes(status as (typeof STATUS_DIIZINKAN)[number])) {
    return NextResponse.json({ error: 'status hanya HADIR_MANUAL, SAKIT, atau IZIN' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: sesi } = await admin
    .from('sessions')
    .select('id, class_id, status')
    .eq('id', sessionId)
    .eq('teacher_id', profil.id)
    .maybeSingle()

  if (!sesi) return NextResponse.json({ error: 'sesi tidak ditemukan' }, { status: 404 })
  if (sesi.status !== 'ACTIVE') return NextResponse.json({ error: 'sesi sudah ditutup' }, { status: 409 })

  const { data: siswa } = await admin
    .from('users')
    .select('id, class_id, role')
    .eq('id', studentId)
    .maybeSingle()
  if (!siswa || siswa.role !== 'SISWA' || siswa.class_id !== sesi.class_id) {
    return NextResponse.json({ error: 'siswa bukan anggota kelas sesi ini' }, { status: 403 })
  }

  const { error } = await admin
    .from('attendance_logs')
    .upsert(
      { session_id: sesi.id, student_id: siswa.id, status, notes: notes || null },
      { onConflict: 'session_id,student_id' },
    )

  if (error) return NextResponse.json({ error: 'gagal menyimpan status' }, { status: 500 })

  return NextResponse.json({ ok: true, status })
}
