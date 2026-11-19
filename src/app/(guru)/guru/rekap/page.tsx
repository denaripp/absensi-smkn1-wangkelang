import { connection } from 'next/server'
import { cookies } from 'next/headers'
import PanelRekap from '@/components/PanelRekap'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kelasDiampu } from '@/lib/otoritas'
import { tanggalTujuhHariLaluWIB, tanggalWIB, hariIniLabel } from '@/lib/format'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'

export const instant = false

export default async function HalamanRekap() {
  await connection()

  const jar = await cookies()
  const sesi = verifikasiSesiToken(jar.get('app_session')?.value)
  const admin = createAdminClient()

  let userId = sesi?.id ?? ''
  let supabase: Awaited<ReturnType<typeof createServerSupabase>> | null = null

  if (!userId) {
    supabase = await createServerSupabase()
    const { data: authData } = await supabase.auth.getUser()
    userId = authData.user?.id ?? ''
  }

  if (!userId) {
    return (
      <p className="rounded-2xl bg-kartu p-6 text-sm text-teks-2 shadow-bento">
        Sesi login tidak valid. Silakan keluar dan masuk kembali.
      </p>
    )
  }

  supabase = supabase ?? (await createServerSupabase())

  // Paralelkan kelasDiampu dan mapel
  const [idKelas, { data: mapel }] = await Promise.all([
    kelasDiampu(admin, userId),
    supabase
      .from('teacher_subjects')
      .select('id, subject_name')
      .eq('teacher_id', userId)
      .order('subject_name'),
  ])

  const { data: kelas } = idKelas.length
    ? await supabase.from('classes').select('id, class_name').in('id', idKelas).order('class_name')
    : { data: [] }

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
