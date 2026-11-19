import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { verifikasiSesiToken } from '@/lib/sesi-cookie'
import { buatToken } from '@/lib/qr'
import { tanggalWIB } from '@/lib/format'

const NIP_GURU_DEMO = '198705122010011004'
const NAMA_KELAS_DEMO = 'XII RPL 1'

export async function POST(request: Request) {
  const jar = await cookies()
  const sesiToken = verifikasiSesiToken(jar.get('app_session')?.value)

  const admin = createAdminClient()
  let userId = sesiToken?.id

  if (!userId) {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'belum login' }, { status: 401 })
    }
    userId = user.id
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 })
  }

  const action = String(body.action ?? '')
  if (!action) {
    return NextResponse.json({ error: 'action wajib diisi' }, { status: 400 })
  }

  // 1. Tentukan class_id target (prioritaskan kelas siswa, fallback ke XII RPL 1)
  const { data: userRecord } = await admin
    .from('users')
    .select('id, full_name, identifier, class_id, role')
    .eq('id', userId)
    .maybeSingle()

  let classId = userRecord?.class_id
  if (!classId) {
    const { data: kelasDemo } = await admin
      .from('classes')
      .select('id')
      .eq('class_name', NAMA_KELAS_DEMO)
      .maybeSingle()
    classId = kelasDemo?.id
  }

  if (!classId) {
    return NextResponse.json({ error: 'kelas tidak ditemukan' }, { status: 404 })
  }

  // 2. Ambil guru demo & mapel
  const { data: guruDemo } = await admin
    .from('users')
    .select('id, full_name')
    .eq('identifier', NIP_GURU_DEMO)
    .maybeSingle()

  if (!guruDemo) {
    return NextResponse.json({ error: 'guru demo tidak ditemukan' }, { status: 404 })
  }

  const { data: daftarMapel } = await admin
    .from('teacher_subjects')
    .select('id, subject_name')
    .eq('teacher_id', guruDemo.id)

  const subjectId = String(body.subjectId ?? '') || (daftarMapel?.[0]?.id ?? '')

  // ================= ACTION: BUKA =================
  if (action === 'buka') {
    // Cek apakah ada sesi yang sedang ACTIVE di kelas ini
    const { data: sesiAktif } = await admin
      .from('sessions')
      .select('id, subject_id, teacher_id, status, started_at')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (sesiAktif) {
      const mapelName = daftarMapel?.find((m) => m.id === sesiAktif.subject_id)?.subject_name ?? 'Mata pelajaran'
      return NextResponse.json({
        sukses: true,
        sessionId: sesiAktif.id,
        status: 'ACTIVE',
        mapel: mapelName,
        guru: guruDemo.full_name,
        pesan: 'Sesi sudah dalam kondisi aktif',
      })
    }

    // Jika belum ada yang aktif, cek apakah ada sesi hari ini yang CLOSED untuk mapel tersebut atau mapel apapun
    const hariIni = tanggalWIB()
    const { data: sesiHariIni } = await admin
      .from('sessions')
      .select('id, subject_id')
      .eq('class_id', classId)
      .eq('session_date', hariIni)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sesiHariIni) {
      // Re-open sesi hari ini menjadi ACTIVE
      const { error: errUpdate } = await admin
        .from('sessions')
        .update({
          status: 'ACTIVE',
          ended_at: null,
          started_at: new Date().toISOString(),
          subject_id: subjectId || sesiHariIni.subject_id,
        })
        .eq('id', sesiHariIni.id)

      if (errUpdate) {
        return NextResponse.json({ error: 'gagal mengaktifkan kembali sesi: ' + errUpdate.message }, { status: 500 })
      }

      const mapelName = daftarMapel?.find((m) => m.id === (subjectId || sesiHariIni.subject_id))?.subject_name ?? 'Mata pelajaran'
      return NextResponse.json({
        sukses: true,
        sessionId: sesiHariIni.id,
        status: 'ACTIVE',
        mapel: mapelName,
        guru: guruDemo.full_name,
        pesan: 'Sesi hari ini diaktifkan kembali',
      })
    }

    // Buat sesi baru
    const { data: sesiBaru, error: errInsert } = await admin
      .from('sessions')
      .insert({
        teacher_id: guruDemo.id,
        class_id: classId,
        subject_id: subjectId,
        status: 'ACTIVE',
        session_date: hariIni,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (errInsert || !sesiBaru) {
      return NextResponse.json({ error: 'gagal membuat sesi baru: ' + (errInsert?.message ?? '?') }, { status: 500 })
    }

    const mapelName = daftarMapel?.find((m) => m.id === subjectId)?.subject_name ?? 'Mata pelajaran'
    return NextResponse.json({
      sukses: true,
      sessionId: sesiBaru.id,
      status: 'ACTIVE',
      mapel: mapelName,
      guru: guruDemo.full_name,
      pesan: 'Sesi simulasi baru berhasil dibuka',
    })
  }

  // ================= ACTION: TUTUP =================
  if (action === 'tutup') {
    const { data: sesiAktif } = await admin
      .from('sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!sesiAktif) {
      return NextResponse.json({ sukses: true, pesan: 'Tidak ada sesi aktif yang perlu ditutup' })
    }

    const { error: errClose } = await admin
      .from('sessions')
      .update({
        status: 'CLOSED',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sesiAktif.id)

    if (errClose) {
      return NextResponse.json({ error: 'gagal menutup sesi: ' + errClose.message }, { status: 500 })
    }

    return NextResponse.json({ sukses: true, pesan: 'Sesi berhasil ditutup' })
  }

  // ================= ACTION: TOKEN =================
  if (action === 'token') {
    const { data: sesiAktif } = await admin
      .from('sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!sesiAktif) {
      return NextResponse.json({ error: 'belum ada sesi aktif di kelas ini' }, { status: 404 })
    }

    const { token, expiresInMs } = buatToken(sesiAktif.id)
    return NextResponse.json({
      sukses: true,
      token,
      expiresInMs,
      urlScan: `/siswa/scan?token=${encodeURIComponent(token)}`,
    })
  }

  // ================= ACTION: ABSEN-OTOMATIS =================
  if (action === 'absen-otomatis') {
    const { data: sesiAktif } = await admin
      .from('sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!sesiAktif) {
      return NextResponse.json({ error: 'tidak ada sesi aktif untuk kelasmu' }, { status: 404 })
    }

    const targetStudentId = String(body.studentId ?? '') || userId
    const { error: errAbsen } = await admin.from('attendance_logs').upsert(
      {
        session_id: sesiAktif.id,
        student_id: targetStudentId,
        status: 'HADIR',
        scanned_at: new Date().toISOString(),
      },
      { onConflict: 'session_id, student_id' },
    )

    if (errAbsen) {
      return NextResponse.json({ error: 'gagal mencatat absensi: ' + errAbsen.message }, { status: 500 })
    }

    return NextResponse.json({
      sukses: true,
      status: 'HADIR',
      pesan: 'Presensi simulasi berhasil dicatat sebagai HADIR',
    })
  }

  // ================= ACTION: RESET-ABSEN =================
  if (action === 'reset-absen') {
    const { data: sesiAktif } = await admin
      .from('sessions')
      .select('id')
      .eq('class_id', classId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!sesiAktif) {
      return NextResponse.json({ error: 'tidak ada sesi aktif' }, { status: 404 })
    }

    const targetStudentId = String(body.studentId ?? '') || userId
    const { error: errDel } = await admin
      .from('attendance_logs')
      .delete()
      .eq('session_id', sesiAktif.id)
      .eq('student_id', targetStudentId)

    if (errDel) {
      return NextResponse.json({ error: 'gagal mereset absensi: ' + errDel.message }, { status: 500 })
    }

    return NextResponse.json({
      sukses: true,
      pesan: 'Log presensi berhasil direset',
    })
  }

  return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 })
}
