import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { buatToken } from '@/lib/qr'

export async function GET(request: Request) {
  const { profil, galat } = await requireRole('GURU')
  if (galat) return galat

  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? ''
  if (!sessionId) return NextResponse.json({ error: 'sessionId wajib' }, { status: 400 })

  const admin = createAdminClient()
  const { data: sesi } = await admin
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('teacher_id', profil.id)
    .maybeSingle()

  if (!sesi) return NextResponse.json({ error: 'sesi tidak ditemukan' }, { status: 404 })
  if (sesi.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'sesi sudah ditutup' }, { status: 409 })
  }

  const { token, expiresInMs } = buatToken(sesi.id)
  return NextResponse.json({ token, expiresInMs }, { headers: { 'cache-control': 'no-store' } })
}
