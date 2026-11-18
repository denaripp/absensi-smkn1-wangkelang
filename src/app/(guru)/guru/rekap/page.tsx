import { connection } from 'next/server'
import PanelRekap from '@/components/PanelRekap'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kelasDiampu } from '@/lib/otoritas'
import { tanggalTujuhHariLaluWIB, tanggalWIB, hariIniLabel } from '@/lib/format'

export const instant = false

export default async function HalamanRekap() {
  await connection()

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const idKelas = user ? await kelasDiampu(admin, user.id) : []

  const [{ data: kelas }, { data: mapel }] = await Promise.all([
    idKelas.length
      ? supabase.from('classes').select('id, class_name').in('id', idKelas).order('class_name')
      : Promise.resolve({ data: [] }),
    supabase
      .from('teacher_subjects')
      .select('id, subject_name')
      .eq('teacher_id', user?.id ?? '')
      .order('subject_name'),
  ])

  const kelasList = (kelas ?? []).map((k) => ({ id: k.id, nama: k.class_name }))
  const mapelList = (mapel ?? []).map((m) => ({ id: m.id, nama: m.subject_name }))

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-black">Rekap &amp; Laporan</h1>
        <p className="text-sm text-teks-2">
          Filter per kelas, mapel, dan rentang tanggal. Hasil diunduh sebagai .xlsx siap cetak.
        </p>
        <p className="text-xs text-teks-2">Hari ini (WIB): {hariIniLabel()}</p>
      </header>
      <PanelRekap
        kelasList={kelasList}
        mapelList={mapelList}
        bawalDari={tanggalTujuhHariLaluWIB()}
        bawalSampai={tanggalWIB()}
      />
    </div>
  )
}
