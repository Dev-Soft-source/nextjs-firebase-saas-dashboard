'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

type WorkspaceInfo = {
  workspaceId: string
  role: string
  name: string
  slug: string
  ownerId: string
  plan: string
}

type Props = {
  workspace: WorkspaceInfo | null
}

export default function TopNavigation({ workspace }: Props) {
  const router = useRouter()

  async function handleLogout() {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">
          {workspace?.name || 'Workspace'}
        </h1>
        <p className="text-sm text-gray-500">Team dashboard</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Switch workspace
        </button>

        <button
          onClick={handleLogout}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Logout
        </button>
      </div>
    </header>
  )
}