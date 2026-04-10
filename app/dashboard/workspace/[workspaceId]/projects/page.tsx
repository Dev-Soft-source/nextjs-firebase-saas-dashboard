'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createProject } from '@/services/projects'
import { waitForAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'

type ProjectItem = {
  id: string
  name: string
  description: string
  status: 'active' | 'archived'
}

export default function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  async function getToken() {
    const user = auth.currentUser
    if (!user) {
      router.push('/login')
      throw new Error('Not authenticated')
    }
    return user.getIdToken()
  }

  async function loadProjects() {
    try {
      setLoading(true)
      setError('')

      const idToken = await getToken()

      const res = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      console.log('Response:', res)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load projects')
      }

      setProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    loadProjects()
  }, [workspaceId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const user = await waitForAuth()
    if (!user) return

    await createProject(workspaceId, name, description, user.uid)
      setName('')
      setDescription('')
      await loadProjects()
  }

  async function toggleStatus(project: ProjectItem) {
    try {
      setBusyId(`status-${project.id}`)
      setError('')

      const idToken = await getToken()

      const nextStatus = project.status === 'active' ? 'archived' : 'active'

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${project.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update project')
      }

      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id ? { ...item, status: nextStatus } : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId('')
    }
  }

  async function deleteProject(projectId: string) {
    const ok = window.confirm('Delete this project?')
    if (!ok) return

    try {
      setBusyId(`delete-${projectId}`)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete project')
      }

      setProjects((prev) => prev.filter((item) => item.id !== projectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Projects</h2>
        <p className="text-sm text-gray-500">
          Create and manage workspace projects
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border bg-white p-5"
      >
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <textarea
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Project'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">
          No projects yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div key={project.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <button
                    onClick={() =>
                      router.push(
                        `/dashboard/workspace/${workspaceId}/projects/${project.id}`
                      )
                    }
                    className="text-left text-lg font-semibold hover:underline"
                  >
                    {project.name}
                  </button>

                  <p className="mt-2 text-sm text-gray-600">
                    {project.description || 'No description'}
                  </p>

                  <span className="mt-3 inline-block rounded-full border px-2 py-1 text-xs">
                    {project.status}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStatus(project)}
                    disabled={busyId === `status-${project.id}`}
                    className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {busyId === `status-${project.id}`
                      ? '...'
                      : project.status === 'active'
                      ? 'Archive'
                      : 'Activate'}
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    disabled={busyId === `delete-${project.id}`}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
                  >
                    {busyId === `delete-${project.id}` ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}