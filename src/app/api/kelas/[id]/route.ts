import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TINGKAT = ['X', 'XI', 'XII']

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const perubahan: Record<string, unknown> = {}
  if (body.nama !== undefined) {
    const nama = String(body.nama).trim()
    if (nama.length < 2 || nama.length > 64) return tolak('nama kelas 2-64 karakter', 400)
    perubahan.class_name = nama
  }
  if (body.jurusan !== undefined) {
    const jurusan = String(body.jurusan).trim()
    if (jurusan.length < 2 || jurusan.length > 96) return tolak('jurusan 2-96 karakter', 400)
    perubahan.major = jurusan
  }
  if (body.tingkat !== undefined) {
    const tingkat = String(body.tingkat).trim().toUpperCase()
    if (!TINGKAT.includes(tingkat)) return tolak('tingkat harus X, XI, atau XII', 400)
    perubahan.grade = tingkat
  }
  if (Object.keys(perubahan).length === 0) return tolak('tidak ada perubahan', 400)

  const admin = createAdminClient()
  const { error } = await admin.from('classes').update(perubahan).eq('id', id)
  if (error) {
    if (error.code === '23505') return tolak('nama kelas sudah dipakai', 409)
    return tolak('gagal menyimpan kelas', 500)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  const admin = createAdminClient()

  const { count } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('role', 'SISWA')

  if ((count ?? 0) > 0) {
    return tolak(`kelas masih punya ${count} siswa, pindahkan atau hapus dulu`, 409)
  }

  const { error } = await admin.from('classes').delete().eq('id', id)
  if (error) return tolak('gagal menghapus kelas', 500)

  return NextResponse.json({ ok: true })
}
