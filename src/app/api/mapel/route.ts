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

  const nama = String(body.nama ?? '').trim()
  if (nama.length < 2 || nama.length > 96) {
    return NextResponse.json({ error: 'nama mapel 2-96 karakter' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('teacher_subjects')
    .insert({ teacher_id: profil.id, subject_name: nama })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'mapel ini sudah ada' }, { status: 409 })
    return NextResponse.json({ error: 'gagal menyimpan mapel' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
