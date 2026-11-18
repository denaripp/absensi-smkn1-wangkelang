import { connection } from 'next/server'
import PanelMapel from '@/components/PanelMapel'
import { createServerSupabase } from '@/lib/supabase/server'

export const instant = false

export default async function HalamanMapel() {
  await connection()

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: mapel }, { data: sesi }] = await Promise.all([
    supabase
      .from('teacher_subjects')
      .select('id, subject_name')
      .eq('teacher_id', user?.id ?? '')
      .order('subject_name'),
    supabase.from('sessions').select('subject_id').eq('teacher_id', user?.id ?? ''),
  ])

  const perMapel = new Map<string, number>()
  for (const s of sesi ?? []) perMapel.set(s.subject_id, (perMapel.get(s.subject_id) ?? 0) + 1)

  const mapelList = (mapel ?? []).map((m) => ({
    id: m.id,
    nama: m.subject_name,
    jumlahSesi: perMapel.get(m.id) ?? 0,
  }))

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-black">Mapel yang Kamu Ampu</h1>
        <p className="text-sm text-teks-2">Satu guru boleh mengampu lebih dari satu mata pelajaran.</p>
      </header>
      <PanelMapel mapelList={mapelList} />
    </div>
  )
}
