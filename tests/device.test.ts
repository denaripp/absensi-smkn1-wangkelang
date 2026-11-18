import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'

const { buatFingerprint, periksaDevice } = await import('../src/lib/device.ts')

type Baris = { device_lock_id: string | null; device_fingerprint: string | null }

function adminPalsu(awal: Baris) {
  const state: Baris = { ...awal }
  const audit: Record<string, unknown>[] = []

  const client = {
    from(tabel: string) {
      if (tabel === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { ...state }, error: null }),
            }),
          }),
          update: (nilai: Partial<Baris> & { device_locked_at?: string }) => ({
            eq: async () => {
              Object.assign(state, nilai)
              return { error: null }
            },
          }),
        }
      }
      if (tabel === 'device_lock_audit') {
        return {
          insert: async (baris: Record<string, unknown>) => {
            audit.push(baris)
            return { error: null }
          },
        }
      }
      throw new Error(`tabel tak dikenal: ${tabel}`)
    },
  }

  return { admin: client as unknown as SupabaseClient, state, audit }
}

test('fingerprint deterministik dan 64 hex', () => {
  const bahan = { userAgent: 'UA', platform: 'Android', layar: '1080x2400', zona: 'Asia/Jakarta' }
  const a = buatFingerprint(bahan)
  const b = buatFingerprint({ ...bahan })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('fingerprint berubah kalau salah satu bahan berubah', () => {
  const dasar = { userAgent: 'UA', platform: 'Android', layar: '1080x2400', zona: 'Asia/Jakarta' }
  const lain = buatFingerprint({ ...dasar, layar: '720x1600' })
  assert.notEqual(buatFingerprint(dasar), lain)
})

test('HP baru langsung dikunci pada login pertama (LOCK) + audit', async () => {
  const { admin, state, audit } = adminPalsu({ device_lock_id: null, device_fingerprint: null })
  const hasil = await periksaDevice(admin, 'siswa-1', 'dev-1', 'fp-1')

  assert.deepEqual(hasil, { hasil: 'LOCK' })
  assert.equal(state.device_lock_id, 'dev-1')
  assert.equal(state.device_fingerprint, 'fp-1')
  assert.equal(audit.length, 1)
  assert.equal(audit[0].action, 'LOCK')
})

test('perangkat yang sama lolos tanpa audit baru', async () => {
  const { admin, audit } = adminPalsu({ device_lock_id: 'dev-1', device_fingerprint: 'fp-1' })
  const hasil = await periksaDevice(admin, 'siswa-1', 'dev-1', 'fp-1')

  assert.deepEqual(hasil, { hasil: 'OK' })
  assert.equal(audit.length, 0)
})

test('HP lain ditolak MISMATCH walau UUID dicuri', async () => {
  const { admin, audit } = adminPalsu({ device_lock_id: 'dev-1', device_fingerprint: 'fp-1' })
  const hasil = await periksaDevice(admin, 'siswa-1', 'dev-1', 'fp-BEDA')

  assert.deepEqual(hasil, { hasil: 'MISMATCH' })
  assert.equal(audit.length, 1)
  assert.equal(audit[0].action, 'MISMATCH')
})

test('uuid beda walau fingerprint sama tetap MISMATCH', async () => {
  const { admin } = adminPalsu({ device_lock_id: 'dev-1', device_fingerprint: 'fp-1' })
  const hasil = await periksaDevice(admin, 'siswa-1', 'dev-2', 'fp-1')
  assert.deepEqual(hasil, { hasil: 'MISMATCH' })
})
