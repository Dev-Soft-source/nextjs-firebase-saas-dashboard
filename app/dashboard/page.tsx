'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthUser } from '@/lib/useAuthUser'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuthUser()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading) return <p className="p-6">Loading...</p>
  if (!user) return null

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2">Welcome, {user.displayName || user.email}</p>
    </main>
  )
}