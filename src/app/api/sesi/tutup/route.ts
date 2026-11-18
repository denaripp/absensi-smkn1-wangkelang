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

  const sessionId = String(body.sessionId ?? '')
  if (!sessionId) return NextResponse.json({ error: 'sessionId wajib' }, { status: 400 })

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
    .select('id')
    .eq('class_id', sesi.class_id)
    .eq('role', 'SISWA')
    .eq('is_active', true)

  const { data: sudah } = await admin
    .from('attendance_logs')
    .select('student_id')
    .eq('session_id', sesi.id)

  const sudahSet = new Set((sudah ?? []).map((r) => r.student_id))
  const alpa = (siswa ?? [])
    .filter((s) => !sudahSet.has(s.id))
    .map((s) => ({ session_id: sesi.id, student_id: s.id, status: 'ALPA' as const }))

  if (alpa.length) {
    const { error: galatAlpa } = await admin.from('attendance_logs').insert(alpa)
    if (galatAlpa) return NextResponse.json({ error: 'gagal menandai alpa' }, { status: 500 })
  }

  const { error: galatTutup } = await admin
    .from('sessions')
    .update({ status: 'CLOSED', ended_at: new Date().toISOString() })
    .eq('id', sesi.id)
  if (galatTutup) return NextResponse.json({ error: 'gagal menutup sesi' }, { status: 500 })

  return NextResponse.json({ ok: true, alpa: alpa.length, totalSiswa: (siswa ?? []).length })
}
