import type { SupabaseClient } from '@supabase/supabase-js'

// "Kelas yang diampu" = kelas punya jadwal mapel guru ini, ATAU pernah ada sesi guru ini di kelas itu.
export async function kelasDiampu(admin: SupabaseClient, guruId: string): Promise<string[]> {
  const [{ data: mapel }, { data: sesi }] = await Promise.all([
    admin.from('teacher_subjects').select('id').eq('teacher_id', guruId),
    admin.from('sessions').select('class_id').eq('teacher_id', guruId),
  ])

  const kelas = new Set<string>()
  for (const s of sesi ?? []) kelas.add(s.class_id)

  const idMapel = (mapel ?? []).map((m) => m.id)
  if (idMapel.length > 0) {
    const { data: jadwal } = await admin
      .from('schedules')
      .select('class_id')
      .in('subject_id', idMapel)
    for (const j of jadwal ?? []) kelas.add(j.class_id)
  }

  return [...kelas]
}

export async function bolehKelolaKelas(
  admin: SupabaseClient,
  guruId: string,
  classId: string,
): Promise<boolean> {
  const daftar = await kelasDiampu(admin, guruId)
  return daftar.includes(classId)
}
