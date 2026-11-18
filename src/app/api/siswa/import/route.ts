import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { kelasDiampu } from '@/lib/otoritas'

type BarisGagal = { baris: number; alasan: string }

const POLA_NISN = /^[0-9]{4,20}$/

export async function POST(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  let file: File | null = null
  try {
    const form = await request.formData()
    const nilai = form.get('file')
    if (nilai instanceof File) file = nilai
  } catch {
    return NextResponse.json({ error: 'form tidak valid' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'file .xlsx wajib diunggah' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'file maksimal 2 MB' }, { status: 400 })
  }

  let baris: Record<string, unknown>[]
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    baris = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'file tidak bisa dibaca sebagai .xlsx' }, { status: 400 })
  }

  const admin = createAdminClient()
  const kelasGuru = await kelasDiampu(admin, profil.id)
  const { data: semuaKelas } = await admin.from('classes').select('id, class_name')
  const petaKelas = new Map(
    (semuaKelas ?? []).map((k) => [k.class_name.trim().toLowerCase(), k.id] as const),
  )

  let dibuat = 0
  let dilewati = 0
  const gagal: BarisGagal[] = []

  for (const [index, raw] of baris.entries()) {
    const nomorBaris = index + 2 // baris 1 = header
    const bersih = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()]),
    )
    const nisn = bersih.nisn ?? bersih['nis']
    const nama = bersih.nama ?? bersih['nama lengkap']
    const namaKelas = bersih.kelas

    if (!nisn && !nama && !namaKelas) continue

    if (!POLA_NISN.test(nisn)) {
      gagal.push({ baris: nomorBaris, alasan: 'NISN harus 4-20 angka' })
      continue
    }
    if (!nama || nama.length < 3) {
      gagal.push({ baris: nomorBaris, alasan: 'nama minimal 3 karakter' })
      continue
    }

    const classId = petaKelas.get((namaKelas ?? '').toLowerCase())
    if (!classId) {
      gagal.push({ baris: nomorBaris, alasan: `kelas "${namaKelas}" tidak ada` })
      continue
    }
    if (!kelasGuru.includes(classId)) {
      gagal.push({ baris: nomorBaris, alasan: 'kelas tidak kamu ampu' })
      continue
    }

    const { data: sudahAda } = await admin.from('users').select('id').eq('identifier', nisn).maybeSingle()
    if (sudahAda) {
      dilewati += 1
      continue
    }

    const { data: auth, error: galatAuth } = await admin.auth.admin.createUser({
      email: `${nisn}@siswa.absensi.local`,
      password: nisn,
      email_confirm: true,
      user_metadata: { nama, nisn },
    })
    if (galatAuth || !auth.user) {
      gagal.push({ baris: nomorBaris, alasan: galatAuth?.message ?? 'gagal membuat akun' })
      continue
    }

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
      gagal.push({ baris: nomorBaris, alasan: galatProfil.message })
      continue
    }

    dibuat += 1
  }

  return NextResponse.json({ dibuat, dilewati, gagal })
}
