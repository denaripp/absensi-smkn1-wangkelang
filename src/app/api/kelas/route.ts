import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TINGKAT = ['X', 'XI', 'XII']

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function POST(request: Request) {
  const { galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const nama = String(body.nama ?? '').trim()
  const jurusan = String(body.jurusan ?? '').trim()
  const tingkat = String(body.tingkat ?? '').trim().toUpperCase()

  if (nama.length < 2 || nama.length > 64) return tolak('nama kelas 2-64 karakter', 400)
  if (jurusan.length < 2 || jurusan.length > 96) return tolak('jurusan 2-96 karakter', 400)
  if (!TINGKAT.includes(tingkat)) return tolak('tingkat harus X, XI, atau XII', 400)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('classes')
    .insert({ class_name: nama, major: jurusan, grade: tingkat })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return tolak('nama kelas sudah dipakai', 409)
    return tolak('gagal menyimpan kelas', 500)
  }

  return NextResponse.json({ ok: true, id: data.id })
}
