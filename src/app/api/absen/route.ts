import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { verifikasiToken } from '@/lib/qr'
import { periksaDevice } from '@/lib/device'
import { jamWIB } from '@/lib/format'
import { batasi, ipDari } from '@/lib/limit'

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POLA_FINGERPRINT = /^[0-9a-f]{64}$/i

function tolak(pesan: string, status: number) {
  return NextResponse.json({ error: pesan }, { status })
}

export async function POST(request: Request) {
  const batas = batasi(`absen:${ipDari(request)}`, 10, 60_000)
  if (!batas.boleh) {
    return NextResponse.json(
      { error: `terlalu banyak percobaan, tunggu ${batas.tungguDetik} detik` },
      { status: 429, headers: { 'retry-after': String(batas.tungguDetik) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return tolak('body bukan JSON', 400)
  }

  const token = String(body.token ?? '')
  const deviceLockId = String(body.deviceLockId ?? '')
  const fingerprint = String(body.fingerprint ?? '')

  if (!token) return tolak('token QR tidak ada', 400)
  if (!POLA_UUID.test(deviceLockId) || !POLA_FINGERPRINT.test(fingerprint)) {
    return tolak('identitas perangkat tidak terdeteksi, muat ulang halaman', 400)
  }

  const tervalidasi = verifikasiToken(token)
  if (!tervalidasi) return tolak('QR kedaluwarsa, minta guru tampilkan ulang', 400)

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tolak('belum login', 401)

  const admin = createAdminClient()

  const { data: sesi } = await admin
    .from('sessions')
    .select('id, class_id, status')
    .eq('id', tervalidasi.sessionId)
    .maybeSingle()
  if (!sesi) return tolak('sesi tidak ditemukan', 404)
  if (sesi.status !== 'ACTIVE') return tolak('sesi sudah ditutup', 409)

  const { data: siswa } = await admin
    .from('users')
    .select('id, class_id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()
  if (!siswa || siswa.role !== 'SISWA' || !siswa.is_active) {
    return tolak('akun bukan siswa aktif', 403)
  }
  if (siswa.class_id !== sesi.class_id) return tolak('QR ini bukan untuk kelasmu', 403)

  const device = await periksaDevice(admin, siswa.id, deviceLockId, fingerprint)
  if (device.hasil === 'MISMATCH') {
    return tolak('perangkat berbeda. Hubungi guru untuk reset kunci HP', 403)
  }

  const { error } = await admin
    .from('attendance_logs')
    .insert({ session_id: sesi.id, student_id: siswa.id, status: 'HADIR' })

  if (error?.code === '23505') return tolak('kamu sudah absen di sesi ini', 409)
  if (error) return tolak('gagal menyimpan absensi', 500)

  return NextResponse.json({ status: 'HADIR', jam: jamWIB(new Date()) })
}
