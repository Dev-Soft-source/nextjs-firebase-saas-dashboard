'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

function InviteContent() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`
  const signupHref = `/signup?next=${encodeURIComponent(`/invite/${token}`)}`

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setSignedIn(!!user)
      setReady(true)
    })
    return unsub
  }, [])

  async function acceptInvite() {
    setLoading(true)
    setError('')

    try {
      const user = auth.currentUser

      if (!user) {
        router.push(loginHref)
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invite')
      }

      router.push(`/dashboard/workspace/${data.workspaceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-lg space-y-6 p-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Join workspace</h1>
        <p className="text-sm text-gray-500">
          Use the email this invitation was sent to. You will need an account
          with that email.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!signedIn ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={loginHref}
            className="inline-flex justify-center rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            Sign in to accept
          </Link>
          <Link
            href={signupHref}
            className="inline-flex justify-center rounded-lg border px-4 py-2 text-sm"
          >
            Create account
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={acceptInvite}
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Accept invite'}
        </button>
      )}
    </main>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg p-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <InviteContent />
    </Suspense>
  )
}
