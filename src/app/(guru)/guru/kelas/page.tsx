import { connection } from 'next/server'
import PanelKelas from '@/components/PanelKelas'
import { createServerSupabase } from '@/lib/supabase/server'

export const instant = false

export default async function HalamanKelas() {
  await connection()

  const supabase = await createServerSupabase()
  const [{ data: kelas }, { data: siswa }] = await Promise.all([
    supabase.from('classes').select('id, class_name, major, grade').order('class_name'),
    supabase.from('users').select('class_id').eq('role', 'SISWA'),
  ])

  const perKelas = new Map<string, number>()
  for (const s of siswa ?? []) {
    if (!s.class_id) continue
    perKelas.set(s.class_id, (perKelas.get(s.class_id) ?? 0) + 1)
  }

  const kelasList = (kelas ?? []).map((k) => ({
    id: k.id,
    nama: k.class_name,
    jurusan: k.major,
    tingkat: k.grade,
    jumlahSiswa: perKelas.get(k.id) ?? 0,
  }))

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-black">Kelola Kelas</h1>
        <p className="text-sm text-teks-2">Tingkat X–XII beserta jurusan. Kelas dipakai bersama seluruh guru.</p>
      </header>
      <PanelKelas kelasList={kelasList} />
    </div>
  )
}
