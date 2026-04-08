'use client'

import { FormEvent, useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await cred.user.getIdToken()

      const res = await fetch('/api/workspace/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load workspaces')
      }

      if (!data.workspaces?.length) {
        router.push('/dashboard')
        return
      }

      router.push(`/dashboard/workspace/${data.workspaces[0].workspaceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Login</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="w-full rounded-lg border px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full rounded-lg border px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </main>
  )
}