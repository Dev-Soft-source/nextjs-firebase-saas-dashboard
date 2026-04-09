'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'

export default function CreateWorkspacePage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = auth.currentUser

      if (!user) {
        router.push('/login')
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create workspace')
      }

      router.push(`/dashboard/workspace/${data.workspaceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Create Workspace</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create workspace'}
        </button>
      </form>
    </main>
  )
}