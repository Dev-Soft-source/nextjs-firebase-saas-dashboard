'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthUser } from '@/lib/useAuthUser'

type WorkspaceItem = {
  workspaceId: string
  role: string
  name: string
  slug: string
  ownerId: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuthUser()
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (loading) return

      if (!user) {
        router.push('/login')
        return
      }

      try {
        const idToken = await user.getIdToken()

        const res = await fetch('/api/workspace/me', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load workspaces')
        }

        setWorkspaces(data.workspaces || [])

        if (data.workspaces?.length === 1) {
          router.push(`/dashboard/workspace/${data.workspaces[0].workspaceId}`)
          return
        }
      } finally {
        setPageLoading(false)
      }
    }

    load()
  }, [user, loading, router])

  if (loading || pageLoading) {
    return <main className="p-6">Loading...</main>
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Your Workspaces</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.workspaceId}
            onClick={() =>
              router.push(`/dashboard/workspace/${workspace.workspaceId}`)
            }
            className="rounded-xl border bg-white p-4 text-left shadow-sm"
          >
            <p className="font-medium">{workspace.name}</p>
            <p className="text-sm text-gray-500">Role: {workspace.role}</p>
          </button>
        ))}
      </div>
    </main>
  )
}