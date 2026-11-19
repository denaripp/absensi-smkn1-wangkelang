// Skrip CLI Simulasi Sesi Presensi SMK Negeri 1 Wangkelang
// Jalankan: node --experimental-strip-types --env-file=.env.local scripts/simulasi-sesi.ts [buka|tutup|status|token|absen|reset-absen]
import { createClient } from '@supabase/supabase-js'
import { buatToken } from '../src/lib/qr.ts'
import { tanggalWIB } from '../src/lib/format.ts'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const NIP_GURU = '198705122010011004'
const NAMA_KELAS = 'XII RPL 1'

async function ambilDataDasar() {
  const { data: kelas, error: eK } = await admin
    .from('classes')
    .select('id, class_name')
    .eq('class_name', NAMA_KELAS)
    .single()
  if (eK || !kelas) throw new Error('Kelas demo tidak ditemukan: ' + (eK?.message ?? '?'))

  const { data: guru, error: eG } = await admin
    .from('users')
    .select('id, full_name, identifier')
    .eq('identifier', NIP_GURU)
    .single()
  if (eG || !guru) throw new Error('Guru demo tidak ditemukan: ' + (eG?.message ?? '?'))

  const { data: mapelList } = await admin
    .from('teacher_subjects')
    .select('id, subject_name')
    .eq('teacher_id', guru.id)

  return { kelas, guru, mapelList: mapelList ?? [] }
}

async function status() {
  const { kelas, guru, mapelList } = await ambilDataDasar()
  const mapelMap = new Map(mapelList.map((m) => [m.id, m.subject_name]))

  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('*')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!sesiAktif) {
    console.log(
      JSON.stringify(
        {
          kelas: kelas.class_name,
          status: 'TIDAK_ADA_SESI_AKTIF',
          pesan: 'Belum ada sesi aktif untuk kelas ini.',
        },
        null,
        2,
      ),
    )
    return
  }

  const { count: jumlahHadir } = await admin
    .from('attendance_logs')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sesiAktif.id)

  const { token, expiresInMs } = buatToken(sesiAktif.id)

  console.log(
    JSON.stringify(
      {
        kelas: kelas.class_name,
        status: 'ACTIVE',
        sessionId: sesiAktif.id,
        mapel: mapelMap.get(sesiAktif.subject_id) ?? 'Mata pelajaran',
        guru: guru.full_name,
        mulai: sesiAktif.started_at,
        jumlahHadir,
        token,
        expiresInMs,
        urlScan: `http://localhost:3100/siswa/scan?token=${encodeURIComponent(token)}`,
      },
      null,
      2,
    ),
  )
}

async function buka() {
  const { kelas, guru, mapelList } = await ambilDataDasar()
  const mapelMap = new Map(mapelList.map((m) => [m.id, m.subject_name]))
  const subjectId = mapelList[0]?.id
  if (!subjectId) throw new Error('Belum ada mapel untuk guru ini')

  // Cek apakah sudah ada sesi aktif
  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('*')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (sesiAktif) {
    console.log(
      JSON.stringify(
        {
          pesan: 'Sesi sudah dalam kondisi aktif',
          sessionId: sesiAktif.id,
          mapel: mapelMap.get(sesiAktif.subject_id),
          status: 'ACTIVE',
        },
        null,
        2,
      ),
    )
    return
  }

  const hariIni = tanggalWIB()
  const { data: sesiHariIni } = await admin
    .from('sessions')
    .select('id, subject_id')
    .eq('class_id', kelas.id)
    .eq('session_date', hariIni)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sesiHariIni) {
    const { error: errUpdate } = await admin
      .from('sessions')
      .update({
        status: 'ACTIVE',
        ended_at: null,
        started_at: new Date().toISOString(),
        subject_id: subjectId,
      })
      .eq('id', sesiHariIni.id)

    if (errUpdate) throw new Error('Update sesi: ' + errUpdate.message)

    console.log(
      JSON.stringify(
        {
          pesan: 'Sesi hari ini diaktifkan kembali',
          sessionId: sesiHariIni.id,
          mapel: mapelMap.get(subjectId),
          status: 'ACTIVE',
        },
        null,
        2,
      ),
    )
    return
  }

  const { data: sesiBaru, error: errInsert } = await admin
    .from('sessions')
    .insert({
      teacher_id: guru.id,
      class_id: kelas.id,
      subject_id: subjectId,
      status: 'ACTIVE',
      session_date: hariIni,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (errInsert || !sesiBaru) throw new Error('Insert sesi: ' + (errInsert?.message ?? '?'))

  console.log(
    JSON.stringify(
      {
        pesan: 'Sesi simulasi baru berhasil dibuka',
        sessionId: sesiBaru.id,
        mapel: mapelMap.get(subjectId),
        status: 'ACTIVE',
      },
      null,
      2,
    ),
  )
}

async function tutup() {
  const { kelas } = await ambilDataDasar()
  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('id')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!sesiAktif) {
    console.log(JSON.stringify({ pesan: 'Tidak ada sesi aktif yang perlu ditutup' }, null, 2))
    return
  }

  const { error: errClose } = await admin
    .from('sessions')
    .update({
      status: 'CLOSED',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sesiAktif.id)

  if (errClose) throw new Error('Tutup sesi: ' + errClose.message)

  console.log(
    JSON.stringify(
      {
        pesan: 'Sesi berhasil ditutup',
        sessionId: sesiAktif.id,
        status: 'CLOSED',
      },
      null,
      2,
    ),
  )
}

async function token() {
  const { kelas } = await ambilDataDasar()
  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('id')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!sesiAktif) throw new Error('Tidak ada sesi aktif di kelas XII RPL 1')

  const { token: t, expiresInMs } = buatToken(sesiAktif.id)
  console.log(
    JSON.stringify(
      {
        sessionId: sesiAktif.id,
        token: t,
        expiresInMs,
        urlScan: `http://localhost:3100/siswa/scan?token=${encodeURIComponent(t)}`,
      },
      null,
      2,
    ),
  )
}

async function absen(nisn = '0061234501') {
  const { kelas } = await ambilDataDasar()
  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('id')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!sesiAktif) throw new Error('Tidak ada sesi aktif di kelas XII RPL 1')

  const { data: siswa } = await admin
    .from('users')
    .select('id, full_name, identifier')
    .eq('identifier', nisn)
    .single()

  if (!siswa) throw new Error(`Siswa NISN ${nisn} tidak ditemukan`)

  const { error: errAbsen } = await admin.from('attendance_logs').upsert(
    {
      session_id: sesiAktif.id,
      student_id: siswa.id,
      status: 'HADIR',
      scanned_at: new Date().toISOString(),
    },
    { onConflict: 'session_id, student_id' },
  )

  if (errAbsen) throw new Error('Absen: ' + errAbsen.message)

  console.log(
    JSON.stringify(
      {
        pesan: `Presensi siswa ${siswa.full_name} (${siswa.identifier}) berhasil dicatat HADIR`,
        sessionId: sesiAktif.id,
        studentId: siswa.id,
        status: 'HADIR',
      },
      null,
      2,
    ),
  )
}

async function resetAbsen(nisn = '0061234501') {
  const { kelas } = await ambilDataDasar()
  const { data: sesiAktif } = await admin
    .from('sessions')
    .select('id')
    .eq('class_id', kelas.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (!sesiAktif) throw new Error('Tidak ada sesi aktif di kelas XII RPL 1')

  const { data: siswa } = await admin.from('users').select('id, full_name').eq('identifier', nisn).single()
  if (!siswa) throw new Error(`Siswa NISN ${nisn} tidak ditemukan`)

  const { error: errDel } = await admin
    .from('attendance_logs')
    .delete()
    .eq('session_id', sesiAktif.id)
    .eq('student_id', siswa.id)

  if (errDel) throw new Error('Reset absen: ' + errDel.message)

  console.log(
    JSON.stringify(
      {
        pesan: `Presensi siswa ${siswa.full_name} berhasil direset`,
        sessionId: sesiAktif.id,
        studentId: siswa.id,
      },
      null,
      2,
    ),
  )
}

async function main() {
  const perintah = process.argv[2] ?? 'status'
  const param = process.argv[3]

  switch (perintah) {
    case 'status':
      await status()
      break
    case 'buka':
      await buka()
      break
    case 'tutup':
      await tutup()
      break
    case 'token':
      await token()
      break
    case 'absen':
      await absen(param)
      break
    case 'reset-absen':
      await resetAbsen(param)
      break
    default:
      console.log('Perintah tersedia: status | buka | tutup | token | absen [nisn] | reset-absen [nisn]')
  }
}

main().catch((err) => {
  console.error('SIMULASI GAGAL:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
