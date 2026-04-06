'use client'

import { FormEvent, useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

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
          workspaceName: form.workspaceName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed')
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
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>

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
          placeholder="Email"
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

        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Workspace name"
          value={form.workspaceName}
          onChange={(e) =>
            setForm({ ...form, workspaceName: e.target.value })
          }
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </main>
  )
}