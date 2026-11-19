import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (!q || q.length < 2) {
    return NextResponse.json({ siswa: [], kelas: [], mapel: [] })
  }

  const pola = `%${q}%`
  const admin = createAdminClient()

  const [{ data: siswaRaw }, { data: kelasRaw }, { data: mapelRaw }, { data: semuaKelas }] =
    await Promise.all([
      admin
        .from('users')
        .select('id, full_name, identifier, class_id')
        .eq('role', 'SISWA')
        .or(`full_name.ilike.${pola},identifier.ilike.${pola}`)
        .limit(5),
      admin
        .from('classes')
        .select('id, class_name, major')
        .ilike('class_name', pola)
        .limit(3),
      admin
        .from('teacher_subjects')
        .select('id, subject_name')
        .eq('teacher_id', profil.id)
        .ilike('subject_name', pola)
        .limit(3),
      admin.from('classes').select('id, class_name'),
    ])

  const namaKelasMap = new Map((semuaKelas ?? []).map((k) => [k.id, k.class_name]))

  const siswa = (siswaRaw ?? []).map((s) => ({
    id: s.id,
    nama: s.full_name,
    nisn: s.identifier,
    kelas: namaKelasMap.get(s.class_id ?? '') ?? '-',
  }))

  const kelas = (kelasRaw ?? []).map((k) => ({
    id: k.id,
    nama: k.class_name,
    jurusan: k.major,
  }))

  const mapel = (mapelRaw ?? []).map((m) => ({
    id: m.id,
    nama: m.subject_name,
  }))

  return NextResponse.json({ siswa, kelas, mapel })
}
