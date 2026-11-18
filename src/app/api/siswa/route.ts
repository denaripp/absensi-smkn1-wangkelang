import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { bolehKelolaKelas } from '@/lib/otoritas'

const POLA_NISN = /^[0-9]{4,20}$/

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const nisn = String(body.nisn ?? '').trim()
  const nama = String(body.nama ?? '').trim()
  const classId = String(body.classId ?? '')

  if (!POLA_NISN.test(nisn)) return tolak('NISN harus 4-20 angka', 400)
  if (nama.length < 3 || nama.length > 128) return tolak('nama 3-128 karakter', 400)
  if (!classId) return tolak('kelas wajib dipilih', 400)

  const admin = createAdminClient()

  if (!(await bolehKelolaKelas(admin, profil.id, classId))) {
    return tolak('kamu tidak mengampu kelas ini', 403)
  }

  const { data: sudahAda } = await admin.from('users').select('id').eq('identifier', nisn).maybeSingle()
  if (sudahAda) return tolak('NISN sudah terdaftar', 409)

  const { data: auth, error: galatAuth } = await admin.auth.admin.createUser({
    email: `${nisn}@siswa.absensi.local`,
    password: nisn,
    email_confirm: true,
    user_metadata: { nama, nisn },
  })
  if (galatAuth || !auth.user) return tolak('gagal membuat akun: ' + (galatAuth?.message ?? '?'), 400)

  const { error: galatProfil } = await admin.from('users').insert({
    id: auth.user.id,
    identifier: nisn,
    full_name: nama,
    role: 'SISWA',
    class_id: classId,
    must_change_password: true,
  })

  if (galatProfil) {
    await admin.auth.admin.deleteUser(auth.user.id)
    return tolak('gagal menyimpan profil: ' + galatProfil.message, 500)
  }

  return NextResponse.json({ ok: true, id: auth.user.id })
}
