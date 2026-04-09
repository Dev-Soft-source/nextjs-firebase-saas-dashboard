'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'

type InviteItem = {
  id: string
  email: string
  role: 'admin' | 'member'
  status: string
  token: string
  invitedBy: string
  createdAt?: { _seconds?: number; seconds?: number } | null
  expiresAt?: { _seconds?: number; seconds?: number } | null
}

function formatTimestamp(value?: { _seconds?: number; seconds?: number } | null) {
  const seconds = value?.seconds ?? value?._seconds
  if (!seconds) return '—'
  return new Date(seconds * 1000).toLocaleString()
}

export default function InvitesPage() {
  const params = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const workspaceId = params.workspaceId

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState('')

  const [copiedId, setCopiedId] = useState('')
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState<string>('')

  const empty = useMemo(() => !loading && invites.length === 0, [loading, invites])

  const loadInvites = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const user = auth.currentUser
      if (!user) {
        router.push('/login')
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch(`/api/workspaces/${workspaceId}/invites/list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load invites')
      }

      setInvites(data.invites || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router, workspaceId])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  async function onCreateInvite(e: FormEvent) {
    e.preventDefault()
    setCreateMessage('')
    setError('')

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setCreateMessage('Enter an email address.')
      return
    }

    try {
      setCreating(true)
      const user = auth.currentUser
      if (!user) {
        router.push('/login')
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: trimmed, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invite')
      }

      setEmail('')
      setCreateMessage(
        `Invite created. Share the link from the list below (expires in 7 days).`
      )
      await loadInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  async function copyInviteLink(inviteId: string, token: string) {
    try {
      const link = `${window.location.origin}/invite/${token}`
      await navigator.clipboard.writeText(link)
      setCopiedId(inviteId)

      setTimeout(() => {
        setCopiedId('')
      }, 1500)
    } catch {
      setError('Failed to copy invite link')
    }
  }

  async function resendInvite(inviteId: string) {
    try {
      setBusyAction(`resend-${inviteId}`)
      setError('')

      const user = auth.currentUser
      if (!user) {
        router.push('/login')
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/invites/${inviteId}/resend`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend invite')
      }

      await loadInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyAction('')
    }
  }

  async function cancelInvite(inviteId: string) {
    try {
      setBusyAction(`cancel-${inviteId}`)
      setError('')

      const user = auth.currentUser
      if (!user) {
        router.push('/login')
        return
      }

      const idToken = await user.getIdToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/invites/${inviteId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel invite')
      }

      setInvites((prev) => prev.filter((item) => item.id !== inviteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-gray-500">
          Invite teammates by email. They must sign in with that email to accept.
        </p>
      </div>

      <section
        id="new-invite"
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-medium text-gray-900">New invite</h2>
        <form onSubmit={onCreateInvite} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="invite-email" className="sr-only">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              autoComplete="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="sr-only">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'admin' | 'member')
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-40"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {creating ? 'Sending…' : 'Create invite'}
          </button>
        </form>
        {createMessage && (
          <p className="mt-3 text-sm text-green-700">{createMessage}</p>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-900">
          Pending invites
        </h2>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">
            Loading invites...
          </div>
        ) : empty ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">
            No pending invites. Create one above.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
              <div className="col-span-4">Email</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-2">Expires</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {invites.map((invite) => (
              <div
                key={invite.id}
                className="grid grid-cols-12 items-center border-b px-4 py-4 text-sm last:border-b-0"
              >
                <div className="col-span-4">
                  <p className="font-medium text-gray-900">{invite.email}</p>
                  <p className="mt-1 break-all text-xs text-gray-500">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/invite/${invite.token}`
                      : ''}
                  </p>
                </div>

                <div className="col-span-2">
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {invite.role}
                  </span>
                </div>

                <div className="col-span-2 text-gray-600">
                  {formatTimestamp(invite.createdAt)}
                </div>

                <div className="col-span-2 text-gray-600">
                  {formatTimestamp(invite.expiresAt)}
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => copyInviteLink(invite.id, invite.token)}
                    className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {copiedId === invite.id ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    type="button"
                    onClick={() => resendInvite(invite.id)}
                    disabled={busyAction === `resend-${invite.id}`}
                    className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {busyAction === `resend-${invite.id}` ? '...' : 'Resend'}
                  </button>

                  <button
                    type="button"
                    onClick={() => cancelInvite(invite.id)}
                    disabled={busyAction === `cancel-${invite.id}`}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
                  >
                    {busyAction === `cancel-${invite.id}` ? '...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
