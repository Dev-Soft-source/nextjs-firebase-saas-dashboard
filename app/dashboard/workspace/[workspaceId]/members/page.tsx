'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { listMembers, MemberItem } from '@/services/members'
import { useAuthUser } from '@/lib/useAuthUser'
import { formatRole } from '@/lib/member-role'
import { auth } from '@/lib/firebase'

export default function MembersPage() {
  const router = useRouter()
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId

  const { user, loading } = useAuthUser()
  const [members, setMembers] = useState<MemberItem[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  async function loadMembers() {
    try {
      setError('')
      const rows = await listMembers(workspaceId)
      setMembers(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setPageLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }

    if (user && workspaceId) {
      loadMembers()
    }
  }, [user, loading, workspaceId, router])

  async function updateRole(memberId: string, role: 'admin' | 'member') {
    try {
      setBusyKey(`role-${memberId}`)
      setError('')

      const currentUser = auth.currentUser
      if (!currentUser) {
        router.push('/login')
        return
      }

      const idToken = await currentUser.getIdToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ role }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role')
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                role,
              }
            : m
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  async function removeMember(memberId: string) {
    const ok = window.confirm('Remove this member from the workspace?')
    if (!ok) return

    try {
      setBusyKey(`remove-${memberId}`)
      setError('')

      const currentUser = auth.currentUser
      if (!currentUser) {
        router.push('/login')
        return
      }

      const idToken = await currentUser.getIdToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  if (loading || pageLoading) {
    return <div>Loading members...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-gray-500">
            Manage people in this workspace
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/workspace/${workspaceId}/members/invites`)
            }
            className="rounded-lg border px-4 py-2"
          >
            Pending invites
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/workspace/${workspaceId}/members/invites#new-invite`
              )
            }
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Invite member
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="grid grid-cols-12 border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
          <div className="col-span-3">Name</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        {members.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No members found.</div>
        ) : (
          members.map((member) => {
            const busyRole = busyKey === `role-${member.id}`
            const busyRemove = busyKey === `remove-${member.id}`
            const isOwner = member.role === 'owner'

            return (
              <div
                key={member.id}
                className="grid grid-cols-12 items-center border-b px-4 py-4 text-sm last:border-b-0"
              >
                <div className="col-span-3">
                  <p className="font-medium text-gray-900">
                    {member.name || 'Unnamed user'}
                  </p>
                </div>

                <div className="col-span-4 text-gray-600">{member.email}</div>

                <div className="col-span-2">
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {formatRole(member.role)}
                  </span>
                </div>

                <div className="col-span-3 flex justify-end gap-2">
                  {!isOwner && (
                    <>
                      <button
                        onClick={() =>
                          updateRole(
                            member.id,
                            member.role === 'admin' ? 'member' : 'admin'
                          )
                        }
                        disabled={busyRole}
                        className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {busyRole
                          ? '...'
                          : member.role === 'admin'
                          ? 'Make Member'
                          : 'Make Admin'}
                      </button>

                      <button
                        onClick={() => removeMember(member.id)}
                        disabled={busyRemove}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
                      >
                        {busyRemove ? '...' : 'Remove'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}