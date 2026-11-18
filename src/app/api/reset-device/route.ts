import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { bolehKelolaKelas } from '@/lib/otoritas'

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 })
  }

  const studentId = String(body.studentId ?? '')
  if (!studentId) return NextResponse.json({ error: 'studentId wajib' }, { status: 400 })

  const admin = createAdminClient()
  const { data: siswa } = await admin
    .from('users')
    .select('id, class_id, role, device_fingerprint')
    .eq('id', studentId)
    .maybeSingle()

  if (!siswa || siswa.role !== 'SISWA') {
    return NextResponse.json({ error: 'siswa tidak ditemukan' }, { status: 404 })
  }
  if (!(await bolehKelolaKelas(admin, profil.id, siswa.class_id))) {
    return NextResponse.json({ error: 'kamu tidak mengampu kelas siswa ini' }, { status: 403 })
  }

  const { error } = await admin
    .from('users')
    .update({ device_lock_id: null, device_fingerprint: null, device_locked_at: null })
    .eq('id', studentId)
  if (error) return NextResponse.json({ error: 'gagal reset kunci HP' }, { status: 500 })

  await admin.from('device_lock_audit').insert({
    student_id: studentId,
    action: 'RESET',
    old_fingerprint: siswa.device_fingerprint,
    new_fingerprint: null,
    actor_id: profil.id,
  })

  return NextResponse.json({ ok: true })
}
