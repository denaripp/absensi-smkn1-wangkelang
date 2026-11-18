import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { bolehKelolaKelas } from '@/lib/otoritas'

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

  const admin = createAdminClient()
  const { data: siswa } = await admin
    .from('users')
    .select('id, class_id, role')
    .eq('id', id)
    .maybeSingle()
  if (!siswa || siswa.role !== 'SISWA') return tolak('siswa tidak ditemukan', 404)
  if (!(await bolehKelolaKelas(admin, profil.id, siswa.class_id))) {
    return tolak('kamu tidak mengampu kelas siswa ini', 403)
  }

  const perubahan: Record<string, unknown> = {}
  const nama = body.nama === undefined ? undefined : String(body.nama).trim()
  const classId = body.classId === undefined ? undefined : String(body.classId)

  if (nama !== undefined) {
    if (nama.length < 3 || nama.length > 128) return tolak('nama 3-128 karakter', 400)
    perubahan.full_name = nama
  }
  if (classId !== undefined) {
    if (!classId) return tolak('kelas tidak boleh kosong', 400)
    if (!(await bolehKelolaKelas(admin, profil.id, classId))) {
      return tolak('kamu tidak mengampu kelas tujuan', 403)
    }
    perubahan.class_id = classId
  }
  if (Object.keys(perubahan).length === 0) return tolak('tidak ada perubahan', 400)

  const { error } = await admin.from('users').update(perubahan).eq('id', id)
  if (error) return tolak('gagal menyimpan perubahan', 500)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const { id } = await params
  const admin = createAdminClient()

  const { data: siswa } = await admin
    .from('users')
    .select('id, class_id, role')
    .eq('id', id)
    .maybeSingle()
  if (!siswa || siswa.role !== 'SISWA') return tolak('siswa tidak ditemukan', 404)
  if (!(await bolehKelolaKelas(admin, profil.id, siswa.class_id))) {
    return tolak('kamu tidak mengampu kelas siswa ini', 403)
  }

  // Hapus akun auth: profil, absensi, dan audit ikut terhapus lewat cascade.
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return tolak('gagal menghapus siswa: ' + error.message, 500)

  return NextResponse.json({ ok: true })
}
