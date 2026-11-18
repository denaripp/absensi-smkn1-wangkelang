'use client'

import { useState } from 'react'

export default function AksiTombol({
  label,
  alasan,
  varian = 'terang',
}: {
  label: string
  alasan: string
  varian?: 'terang' | 'gelap'
}) {
  const [pesan, setPesan] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        onClick={() => setPesan(alasan)}
        className={
          varian === 'gelap'
            ? 'w-full rounded-full bg-gelap px-4 py-2.5 text-sm font-semibold text-white'
            : 'w-full rounded-full border border-garis px-4 py-2.5 text-sm font-semibold text-teks'
        }
      >
        {label}
      </button>
      {pesan && (
        <p role="status" className="mt-1 text-xs text-izin">
          {pesan}
        </p>
      )}
    </div>
  )
}
