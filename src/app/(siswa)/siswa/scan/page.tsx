import { connection } from 'next/server'
import AbsenDariToken from '@/components/AbsenDariToken'

export const instant = false

export default async function HalamanScan({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  await connection()
  const { token } = await searchParams

  return <AbsenDariToken token={token ?? ''} />
}
