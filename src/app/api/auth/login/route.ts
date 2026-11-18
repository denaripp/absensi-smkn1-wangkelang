import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { periksaDevice } from '@/lib/device'
import { batasi, ipDari } from '@/lib/limit'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POLA_FINGERPRINT = /^[0-9a-f]{64}$/i

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function POST(request: Request) {
  const ip = ipDari(request)
  const batas = batasi(`masuk:${ip}`, 10, 60_000)
  if (!batas.boleh) {
    return NextResponse.json(
      { error: `terlalu banyak percobaan masuk, tunggu ${batas.tungguDetik} detik` },
      { status: 429, headers: { 'retry-after': String(batas.tungguDetik) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const identifier = String(body.identifier ?? '').trim()
  const password = String(body.password ?? '')
  const role = body.role === 'GURU' || body.role === 'SISWA' ? body.role : null

  if (!identifier || !password) return tolak('NISN/NIP dan password wajib diisi', 400)
  if (!role) return tolak('role tidak dikenal', 400)

  const admin = createAdminClient()
  const { data: profil } = await admin
    .from('users')
    .select('id, role, is_active, must_change_password')
    .eq('identifier', identifier)
    .maybeSingle()

  // Pesan disamakan untuk identifier tidak ada vs password salah: jangan bocorkan NISN/NIP mana yang terdaftar.
  if (!profil) return tolak('NISN/NIP atau password salah', 401)
  if (!profil.is_active) return tolak('akun nonaktif, hubungi guru', 403)
  if (profil.role !== role) return tolak('akun ini bukan akun ' + role, 403)

  const { data: authUser, error: galatAuth } = await admin.auth.admin.getUserById(profil.id)
  const email = authUser?.user?.email
  if (galatAuth || !email) return tolak('akun auth tidak ditemukan', 500)

  const supabase = await createServerSupabase()

  // Password diverifikasi lebih dulu supaya perangkat tidak bisa dikunci orang lain tanpa kredensial.
  const { error: galatMasuk } = await supabase.auth.signInWithPassword({ email, password })
  if (galatMasuk) return tolak('NISN/NIP atau password salah', 401)

  if (role === 'SISWA') {
    const deviceLockId = String(body.deviceLockId ?? '')
    const fingerprint = String(body.fingerprint ?? '')

    if (!POLA_UUID.test(deviceLockId) || !POLA_FINGERPRINT.test(fingerprint)) {
      await supabase.auth.signOut()
      return tolak('identitas perangkat tidak terdeteksi, muat ulang halaman', 400)
    }

    const device = await periksaDevice(admin, profil.id, deviceLockId, fingerprint)

    if (device.hasil === 'MISMATCH') {
      await supabase.auth.signOut()
      return tolak('perangkat berbeda. Hubungi guru untuk reset kunci HP', 403)
    }
    if (device.hasil === 'TIDAK_ADA') {
      await supabase.auth.signOut()
      return tolak('akun tidak ditemukan', 401)
    }
  }

  return NextResponse.json({
    ok: true,
    role: profil.role,
    mustChangePassword: profil.must_change_password,
  })
}
