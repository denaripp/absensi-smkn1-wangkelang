import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const nama = String(body.nama ?? '').trim()
  if (nama.length < 2 || nama.length > 96) return tolak('nama mapel 2-96 karakter', 400)

  const admin = createAdminClient()
  const { data: mapel } = await admin
    .from('teacher_subjects')
    .select('id, teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!mapel) return tolak('mapel tidak ditemukan', 404)
  if (mapel.teacher_id !== profil.id) return tolak('mapel ini bukan milikmu', 403)

  const { error } = await admin.from('teacher_subjects').update({ subject_name: nama }).eq('id', id)
  if (error) {
    if (error.code === '23505') return tolak('nama mapel sudah dipakai', 409)
    return tolak('gagal menyimpan mapel', 500)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  const admin = createAdminClient()

  const { data: mapel } = await admin
    .from('teacher_subjects')
    .select('id, teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!mapel) return tolak('mapel tidak ditemukan', 404)
  if (mapel.teacher_id !== profil.id) return tolak('mapel ini bukan milikmu', 403)

  const { count } = await admin
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', id)
  if ((count ?? 0) > 0) {
    return tolak(`mapel sudah dipakai di ${count} sesi, tidak bisa dihapus`, 409)
  }

  const { error } = await admin.from('teacher_subjects').delete().eq('id', id)
  if (error) return tolak('gagal menghapus mapel', 500)

  return NextResponse.json({ ok: true })
}
