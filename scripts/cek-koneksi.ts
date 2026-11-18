// Cek koneksi Supabase: admin (service role) harus bisa baca + tulis, anon harus kena RLS.
// Jalankan: node --experimental-strip-types --env-file=.env.local scripts/cek-koneksi.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function gagal(pesan: string): never {
  console.error(`GAGAL: ${pesan}`)
  process.exit(1)
}

async function main() {
  if (!url || !anonKey || !serviceKey) gagal('env belum lengkap (URL / ANON / SERVICE_ROLE)')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const baca = await admin.from('classes').select('id')
  if (baca.error) gagal(`admin baca classes: ${baca.error.message}`)
  console.log(`ADMIN BACA OK (${baca.data.length} baris)`)

  const jumlahTabel = await admin.from('attendance_logs').select('id', { count: 'exact', head: true })
  if (jumlahTabel.error) gagal(`admin baca attendance_logs: ${jumlahTabel.error.message}`)
  console.log(`ADMIN BACA attendance_logs OK (count=${jumlahTabel.count})`)

  const kelasUji = `KELAS UJI ${Date.now()}`
  const tulis = await admin
    .from('classes')
    .insert({ class_name: kelasUji, major: 'Uji Koneksi', grade: 'X' })
    .select('id')
    .single()
  if (tulis.error) gagal(`admin tulis classes: ${tulis.error.message}`)

  const hapus = await admin.from('classes').delete().eq('id', tulis.data.id)
  if (hapus.error) gagal(`admin hapus classes: ${hapus.error.message}`)
  console.log('ADMIN TULIS+HAPUS OK (roundtrip bersih)')

  const publik = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const anonBaca = await publik.from('classes').select('id')
  if (anonBaca.error) gagal(`anon baca classes: ${anonBaca.error.message}`)
  console.log(`ANON OK (${anonBaca.data.length} baris, RLS menahan data)`)

  const anonTulis = await publik
    .from('classes')
    .insert({ class_name: `ANON ${Date.now()}`, major: 'x', grade: 'X' })
  if (!anonTulis.error) gagal('anon berhasil menulis classes — RLS BOCOR')
  console.log(`ANON TULIS DITOLAK OK (${anonTulis.error.code ?? anonTulis.error.message})`)
}

main().catch((e) => gagal(e instanceof Error ? e.message : String(e)))
