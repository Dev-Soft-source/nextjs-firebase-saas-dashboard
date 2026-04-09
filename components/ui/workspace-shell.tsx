'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import Sidebar from '@/components/ui/sidebar'
import TopNavigation from '@/components/ui/top-navigation'

type Props = {
  workspaceId: string
  children: ReactNode
}

type WorkspaceInfo = {
  workspaceId: string
  role: string
  name: string
  slug: string
  ownerId: string
  plan: string
}

export default function WorkspaceShell({ workspaceId, children }: Props) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadWorkspace() {
      try {
        setLoading(true)
        setError('')

        const user = auth.currentUser
        if (!user) {
          router.push('/login')
          return
        }

        const idToken = await user.getIdToken()

        const res = await fetch('/api/workspaces/me', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load workspace')
        }

        const current = (data.workspaces || []).find(
          (item: WorkspaceInfo) => item.workspaceId === workspaceId
        )

        if (!current) {
          router.push('/dashboard')
          return
        }

        setWorkspace(current)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [router, workspaceId])

  if (loading) {
    return <main className="p-6">Loading workspace...</main>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <Sidebar workspaceId={workspaceId} workspace={workspace} />

        <div className="min-w-0">
          <TopNavigation workspace={workspace} />

          {error && (
            <div className="p-6">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}