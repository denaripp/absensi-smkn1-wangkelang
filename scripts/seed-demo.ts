// Seed demo SMK Negeri 1 Wangkelang. Idempoten: aman dijalankan berulang.
// Jalankan: node --experimental-strip-types --env-file=.env.local scripts/seed-demo.ts
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const NIP_GURU = '198705122010011004'
const NAMA_GURU = 'Rahmat Hidayat, S.Pd.'
const EMAIL_GURU = 'rahmat@smkn1wangkelang.sch.id'
const NAMA_KELAS = 'XII RPL 1'
const JURUSAN = 'Rekayasa Perangkat Lunak'

const MAPEL = [
  'Pemrograman Web & Perangkat Bergerak',
  'Basis Data',
  'Produk Kreatif dan Kewirausahaan',
]

// Senin–Jumat, satu jam pelajaran per hari.
const JADWAL = [
  { day: 1, jam: 1, mulai: '07:00', selesai: '08:30', mapel: 0 },
  { day: 2, jam: 1, mulai: '07:00', selesai: '08:30', mapel: 1 },
  { day: 3, jam: 1, mulai: '07:00', selesai: '08:30', mapel: 2 },
  { day: 4, jam: 1, mulai: '07:00', selesai: '08:30', mapel: 0 },
  { day: 5, jam: 1, mulai: '07:00', selesai: '08:30', mapel: 1 },
]

const NAMA_SISWA = [
  'Ahmad Fauzi',
  'Siti Nurhaliza',
  'Rizky Pratama',
  'Mutiara Kirana',
  'Bagas Saputra',
  'Nabila Putri',
  'Dimas Aditya',
  'Ayu Lestari',
  'Fajar Ramadhan',
  'Intan Permata',
  'Galih Nugroho',
  'Salma Aulia',
  'Yusuf Maulana',
  'Rani Oktaviani',
  'Bayu Setiawan',
  'Dewi Anggraini',
  'Rizal Firmansyah',
  'Tika Marlina',
  'Arif Wibowo',
  'Laila Sari',
  'Hendra Gunawan',
  'Putri Amelia',
  'Wahyu Kurniawan',
  'Sinta Maharani',
  'Ilham Saputra',
  'Novi Yanti',
  'Reza Fadillah',
  'Maya Sari',
  'Andrianto',
  'Fitri Handayani',
  'Gilang Permana',
  'Anisa Rahma',
  'Doni Irawan',
  'Rina Marliana',
  'Sandi Pratama',
  'Wulan Sari',
]

function nisn(urut: number) {
  return `00612345${String(urut).padStart(2, '0')}`
}

async function main() {
  // 1. Kelas
  const { data: kelas, error: eKelas } = await admin
    .from('classes')
    .upsert({ class_name: NAMA_KELAS, major: JURUSAN, grade: 'XII' }, { onConflict: 'class_name' })
    .select('id')
    .single()
  if (eKelas) throw new Error('kelas: ' + eKelas.message)

  // 2. Guru (akun auth harus sudah ada dari pendaftaran; kalau belum, buat)
  let { data: guru } = await admin.from('users').select('id').eq('identifier', NIP_GURU).maybeSingle()

  if (!guru) {
    const { data: authGuru, error: eAuth } = await admin.auth.admin.createUser({
      email: EMAIL_GURU,
      password: 'Guru#2026',
      email_confirm: true,
      user_metadata: { nama: NAMA_GURU, nip: NIP_GURU },
    })
    if (eAuth || !authGuru.user) throw new Error('auth guru: ' + (eAuth?.message ?? '?'))
    const { error: eProfil } = await admin.from('users').insert({
      id: authGuru.user.id,
      identifier: NIP_GURU,
      full_name: NAMA_GURU,
      role: 'GURU',
      must_change_password: true,
    })
    if (eProfil) throw new Error('profil guru: ' + eProfil.message)
    guru = { id: authGuru.user.id }
  }

  // 3. Mapel + jadwal
  const idMapel: string[] = []
  for (const nama of MAPEL) {
    const { data, error } = await admin
      .from('teacher_subjects')
      .upsert({ teacher_id: guru.id, subject_name: nama }, { onConflict: 'teacher_id,subject_name' })
      .select('id')
      .single()
    if (error) throw new Error(`mapel ${nama}: ${error.message}`)
    idMapel.push(data.id)
  }

  for (const j of JADWAL) {
    const { error } = await admin.from('schedules').upsert(
      {
        class_id: kelas.id,
        subject_id: idMapel[j.mapel],
        day_of_week: j.day,
        jam_ke: j.jam,
        jam_mulai: `${j.mulai}:00`,
        jam_selesai: `${j.selesai}:00`,
      },
      { onConflict: 'class_id,day_of_week,jam_ke' },
    )
    if (error) throw new Error(`jadwal hari ${j.day}: ${error.message}`)
  }

  // 4. 36 siswa
  let dibuat = 0
  let diperbarui = 0

  for (let urut = 1; urut <= NAMA_SISWA.length; urut += 1) {
    const identitas = nisn(urut)
    const nama = NAMA_SISWA[urut - 1]

    const { data: ada } = await admin.from('users').select('id').eq('identifier', identitas).maybeSingle()

    if (ada) {
      const { error } = await admin
        .from('users')
        .update({ full_name: nama, class_id: kelas.id, is_active: true })
        .eq('id', ada.id)
      if (error) throw new Error(`perbarui ${identitas}: ${error.message}`)
      diperbarui += 1
      continue
    }

    const { data: authSiswa, error: eAuth } = await admin.auth.admin.createUser({
      email: `${identitas}@siswa.absensi.local`,
      password: identitas,
      email_confirm: true,
      user_metadata: { nama, nisn: identitas },
    })
    if (eAuth || !authSiswa.user) throw new Error(`auth ${identitas}: ${eAuth?.message ?? '?'}`)

    const { error: eProfil } = await admin.from('users').insert({
      id: authSiswa.user.id,
      identifier: identitas,
      full_name: nama,
      role: 'SISWA',
      class_id: kelas.id,
      must_change_password: false,
    })
    if (eProfil) {
      await admin.auth.admin.deleteUser(authSiswa.user.id)
      throw new Error(`profil ${identitas}: ${eProfil.message}`)
    }
    dibuat += 1
  }

  const { count: totalSiswa } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', kelas.id)
    .eq('role', 'SISWA')

  const { count: totalMapel } = await admin
    .from('teacher_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', guru.id)

  const { count: totalJadwal } = await admin
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', kelas.id)

  console.log(
    JSON.stringify({
      kelas: NAMA_KELAS,
      siswaBaru: dibuat,
      siswaDiperbarui: diperbarui,
      totalSiswa,
      totalMapel,
      totalJadwal,
    }),
  )
}

main().catch((e) => {
  console.error('SEED GAGAL:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
