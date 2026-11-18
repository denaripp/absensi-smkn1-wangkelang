import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const POLA_NIP = /^[0-9A-Za-z._-]{3,32}$/

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

function kodeCocok(kirim: string, harap: string) {
  const a = Buffer.from(kirim)
  const b = Buffer.from(harap)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const nip = String(body.nip ?? '').trim()
  const nama = String(body.nama ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const kodeSekolah = String(body.kodeSekolah ?? '')

  const harap = process.env.SCHOOL_SECRET_CODE
  if (!harap) return tolak('kode sekolah belum dikonfigurasi server', 500)

  // Satu pesan untuk kode salah: tidak membocorkan panjang/awalan kode yang benar.
  if (!kodeCocok(kodeSekolah, harap)) return tolak('kode sekolah salah', 403)

  if (!POLA_NIP.test(nip)) return tolak('NIP tidak valid (3-32 huruf/angka)', 400)
  if (nama.length < 3 || nama.length > 128) return tolak('nama 3-128 karakter', 400)
  if (!POLA_EMAIL.test(email)) return tolak('email tidak valid', 400)
  if (password.length < 8) return tolak('password minimal 8 karakter', 400)

  const admin = createAdminClient()

  const { data: sudahAda } = await admin
    .from('users')
    .select('id')
    .eq('identifier', nip)
    .maybeSingle()
  if (sudahAda) return tolak('NIP sudah terdaftar', 409)

  const { data: dibuat, error: galatBuat } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama, nip },
  })
  if (galatBuat || !dibuat.user) return tolak('gagal membuat akun: ' + (galatBuat?.message ?? 'tidak diketahui'), 400)

  const { error: galatProfil } = await admin.from('users').insert({
    id: dibuat.user.id,
    identifier: nip,
    full_name: nama,
    role: 'GURU',
    must_change_password: true,
  })

  if (galatProfil) {
    // Rollback: jangan tinggalkan akun auth tanpa profil.
    await admin.auth.admin.deleteUser(dibuat.user.id)
    return tolak('gagal menyimpan profil guru: ' + galatProfil.message, 500)
  }

  return NextResponse.json({ ok: true })
}
