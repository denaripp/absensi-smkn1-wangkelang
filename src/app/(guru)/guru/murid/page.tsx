import { connection } from 'next/server'
import PanelMurid from '@/components/PanelMurid'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kelasDiampu } from '@/lib/otoritas'

export const instant = false

export default async function HalamanMurid() {
  await connection()

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const idKelas = user ? await kelasDiampu(admin, user.id) : []

  const [{ data: kelas }, { data: siswa }] = await Promise.all([
    idKelas.length
      ? supabase.from('classes').select('id, class_name').in('id', idKelas).order('class_name')
      : Promise.resolve({ data: [] }),
    idKelas.length
      ? supabase
          .from('users')
          .select('id, identifier, full_name, class_id, device_lock_id')
          .eq('role', 'SISWA')
          .in('class_id', idKelas)
          .order('full_name')
      : Promise.resolve({ data: [] }),
  ])

  const namaKelas = new Map((kelas ?? []).map((k) => [k.id, k.class_name]))

  const siswaList = (siswa ?? []).map((s) => ({
    id: s.id,
    nisn: s.identifier,
    nama: s.full_name,
    classId: s.class_id ?? '',
    kelas: namaKelas.get(s.class_id ?? '') ?? '-',
    terkunci: Boolean(s.device_lock_id),
  }))

  const kelasList = (kelas ?? []).map((k) => ({ id: k.id, nama: k.class_name }))

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-black">Data Murid</h1>
        <p className="text-sm text-teks-2">
          Hanya kelas yang kamu ampu ({kelasList.length} kelas, {siswaList.length} siswa).
        </p>
      </header>
      <PanelMurid siswaList={siswaList} kelasList={kelasList} />
    </div>
  )
}
