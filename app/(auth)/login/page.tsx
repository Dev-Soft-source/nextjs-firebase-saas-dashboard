'use client'

import { FormEvent, Suspense, useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

      const nextRaw = searchParams.get('next')
      const nextPath =
        nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')
          ? nextRaw
          : null

      if (nextPath) {
        router.push(nextPath)
        return
      }

      const res = await fetch('/api/workspaces/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load workspaces')
      }

      const workspaces = data.workspaces || []

      if (workspaces.length === 1) {
        router.push(`/dashboard/workspace/${workspaces[0].workspaceId}`)
        return
      }

      if (workspaces.length > 1) {
        router.push('/dashboard')
        return
      }

      router.push('/onboarding/create-workspace')
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

      <p className="mt-6 text-center text-sm text-gray-600">
        No account?{' '}
        <Link
          href={
            searchParams.get('next')
              ? `/signup?next=${encodeURIComponent(searchParams.get('next')!)}`
              : '/signup'
          }
          className="font-medium text-gray-900 underline"
        >
          Sign up
        </Link>
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
