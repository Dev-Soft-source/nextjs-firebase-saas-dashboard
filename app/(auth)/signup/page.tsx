'use client'

import { FormEvent, Suspense, useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextRaw = searchParams.get('next')
  const nextPath =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : null
  const inviteFlow = Boolean(nextPath?.includes('/invite/'))

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    workspaceName: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      )

      if (form.name.trim()) {
        await updateProfile(cred.user, {
          displayName: form.name,
        })
      }

      const idToken = await cred.user.getIdToken()

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          workspaceName: inviteFlow ? '' : form.workspaceName,
          inviteFlow,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      if (nextPath) {
        router.push(nextPath)
        return
      }

      if (data.workspaceId) {
        router.push(`/dashboard/workspace/${data.workspaceId}`)
      } else {
        router.push('/onboarding/create-workspace')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Create account</h1>
      {inviteFlow && (
        <p className="mb-6 text-sm text-gray-500">
          After signing up, you will return to your invitation to join the
          workspace.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <input
          className="w-full rounded-lg border px-3 py-2"
          type="email"
          placeholder="Email (use the address the invite was sent to)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />

        <input
          className="w-full rounded-lg border px-3 py-2"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />

        {!inviteFlow && (
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Workspace name"
            value={form.workspaceName}
            onChange={(e) =>
              setForm({ ...form, workspaceName: e.target.value })
            }
            required
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link
          href={
            nextPath
              ? `/login?next=${encodeURIComponent(nextPath)}`
              : '/login'
          }
          className="font-medium text-gray-900 underline"
        >
          Log in
        </Link>
      </p>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
