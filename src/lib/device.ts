import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function buatFingerprint(bahan: {
  userAgent: string
  platform: string
  layar: string
  zona: string
}) {
  return createHash('sha256')
    .update([bahan.userAgent, bahan.platform, bahan.layar, bahan.zona].join('|'))
    .digest('hex')
}

export type HasilDevice = { hasil: 'OK' | 'LOCK' | 'MISMATCH' | 'TIDAK_ADA' }

export async function periksaDevice(
  admin: SupabaseClient,
  studentId: string,
  deviceLockId: string,
  fingerprint: string,
): Promise<HasilDevice> {
  const { data: user } = await admin
    .from('users')
    .select('device_lock_id, device_fingerprint')
    .eq('id', studentId)
    .single()

  if (!user) return { hasil: 'TIDAK_ADA' }

  if (!user.device_lock_id) {
    await admin
      .from('users')
      .update({
        device_lock_id: deviceLockId,
        device_fingerprint: fingerprint,
        device_locked_at: new Date().toISOString(),
      })
      .eq('id', studentId)
    await admin.from('device_lock_audit').insert({
      student_id: studentId,
      action: 'LOCK',
      new_fingerprint: fingerprint,
    })
    return { hasil: 'LOCK' }
  }

  if (user.device_lock_id === deviceLockId && user.device_fingerprint === fingerprint) {
    return { hasil: 'OK' }
  }

  await admin.from('device_lock_audit').insert({
    student_id: studentId,
    action: 'MISMATCH',
    old_fingerprint: user.device_fingerprint,
    new_fingerprint: fingerprint,
  })
  return { hasil: 'MISMATCH' }
}
