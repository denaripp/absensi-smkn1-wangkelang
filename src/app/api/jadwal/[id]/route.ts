import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  const admin = createAdminClient()

  // Pastikan jadwal ini terkait dengan mapel guru
  const { data: jadwal } = await admin
    .from('schedules')
    .select('id, subject_id')
    .eq('id', id)
    .maybeSingle()
  if (!jadwal) return tolak('jadwal tidak ditemukan', 404)

  const { data: mapel } = await admin
    .from('teacher_subjects')
    .select('id')
    .eq('id', jadwal.subject_id)
    .eq('teacher_id', profil.id)
    .maybeSingle()
  if (!mapel) return tolak('kamu bukan pengampu jadwal ini', 403)

  const { error } = await admin.from('schedules').delete().eq('id', id)
  if (error) return tolak('gagal menghapus jadwal: ' + error.message, 500)

  return NextResponse.json({ ok: true })
}
