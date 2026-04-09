'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'

type WorkspaceItem = {
  workspaceId: string
  role: string
  name: string
  slug: string
  ownerId: string
  plan: string
}

export default function DashboardPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          router.push('/login')
          return
        }

        setUser(currentUser)

        const idToken = await currentUser.getIdToken()

        const res = await fetch('/api/workspaces/me', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load workspaces')
        }

        const items = data.workspaces || []
        setWorkspaces(items)

        if (items.length === 1) {
          router.push(`/dashboard/workspace/${items[0].workspaceId}`)
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [router])

  if (loading) {
    return <main className="p-6">Loading...</main>
  }

  if (!user) {
    return null
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Choose a workspace</h1>
        <p className="text-sm text-gray-500">
          Select the workspace you want to open
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          <p className="mb-4 text-sm text-gray-600">No workspace found.</p>
          <button
            onClick={() => router.push('/onboarding/create-workspace')}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Create workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <button
              key={workspace.workspaceId}
              onClick={() =>
                router.push(`/dashboard/workspace/${workspace.workspaceId}`)
              }
              className="rounded-2xl border bg-white p-5 text-left shadow-sm"
            >
              <p className="text-lg font-medium">{workspace.name}</p>
              <p className="mt-1 text-sm text-gray-500">Role: {workspace.role}</p>
              <p className="text-sm text-gray-500">Plan: {workspace.plan}</p>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
