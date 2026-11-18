// Helper sisi browser: identitas perangkat untuk Device Lock.
const KUNCI = 'absensi.deviceLockId'

export function ambilDeviceLockId(): string {
  let id = window.localStorage.getItem(KUNCI)
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID()
    window.localStorage.setItem(KUNCI, id)
  }
  return id
}

// Hash yang sama dengan src/lib/device.ts (server), hanya medianya beda: Web Crypto vs node:crypto.
export async function buatFingerprintBrowser(): Promise<string> {
  const bahan = [
    navigator.userAgent,
    navigator.platform,
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bahan))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
