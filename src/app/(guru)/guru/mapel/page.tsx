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

  const [{ data: mapel }, { data: sesi }, { data: kelasRaw }, { data: jadwalRaw }] =
    await Promise.all([
      supabase
        .from('teacher_subjects')
        .select('id, subject_name')
        .eq('teacher_id', user?.id ?? '')
        .order('subject_name'),
      supabase.from('sessions').select('subject_id').eq('teacher_id', user?.id ?? ''),
      supabase.from('classes').select('id, class_name').order('class_name'),
      supabase
        .from('schedules')
        .select('id, class_id, subject_id, day_of_week, jam_ke, jam_mulai, jam_selesai')
        .order('day_of_week')
        .order('jam_ke'),
    ])

  const perMapel = new Map<string, number>()
  for (const s of sesi ?? []) perMapel.set(s.subject_id, (perMapel.get(s.subject_id) ?? 0) + 1)

  const mapelList = (mapel ?? []).map((m) => ({
    id: m.id,
    nama: m.subject_name,
    jumlahSesi: perMapel.get(m.id) ?? 0,
  }))

  const idMapelGuru = new Set((mapel ?? []).map((m) => m.id))
  const namaKelas = new Map((kelasRaw ?? []).map((k) => [k.id, k.class_name]))
  const namaMapel = new Map((mapel ?? []).map((m) => [m.id, m.subject_name]))

  const jadwalList = (jadwalRaw ?? [])
    .filter((j) => idMapelGuru.has(j.subject_id))
    .map((j) => ({
      id: j.id,
      classId: j.class_id,
      className: namaKelas.get(j.class_id) ?? '-',
      subjectId: j.subject_id,
      subjectName: namaMapel.get(j.subject_id) ?? '-',
      dayOfWeek: j.day_of_week,
      jamKe: j.jam_ke,
      jamMulai: String(j.jam_mulai).slice(0, 5),
      jamSelesai: String(j.jam_selesai).slice(0, 5),
    }))

  const kelasList = (kelasRaw ?? []).map((k) => ({ id: k.id, nama: k.class_name }))

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-black">Mapel & Jadwal Mengajar</h1>
        <p className="text-sm text-teks-2">
          Kelola mata pelajaran dan jadwal tatap muka kelas yang kamu ampu.
        </p>
      </header>
      <PanelMapel mapelList={mapelList} kelasList={kelasList} jadwalList={jadwalList} />
    </div>
  )
}
