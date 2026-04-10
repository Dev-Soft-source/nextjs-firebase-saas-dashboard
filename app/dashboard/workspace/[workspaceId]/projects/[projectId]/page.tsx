'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'

type Project = {
  id: string
  name: string
  description: string
  status: 'active' | 'archived'
}

type Task = {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignedTo: string
  assignedToName?: string
  assignedToEmail?: string
  dueDate: Date | null
  createdBy?: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

type MemberOption = {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

export default function ProjectDetailsPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>()
  const router = useRouter()
  const { workspaceId, projectId } = params

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>( 'medium' )
  const [loading, setLoading] = useState(true)
  const [creatingTask, setCreatingTask] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const [members, setMembers] = useState<MemberOption[]>([])
  const [assignedTo, setAssignedTo] = useState('')
  
  async function getToken() {
    const user = auth.currentUser
    if (!user) {
      router.push('/login')
      throw new Error('Not authenticated')
    }
    return user.getIdToken()
  }

  async function loadMembers() {
    const idToken = await getToken()

    const res = await fetch(`/api/workspaces/${workspaceId}/members/options`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load members')
    }

    setMembers(data.members || [])
  }

  async function loadProject() {
    try {
      setLoading(true)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load project')
      }

      setProject(data.project)
      setName(data.project.name || '')
      setDescription(data.project.description || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function loadTasks() {
    const idToken = await getToken()

    const res = await fetch(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    )

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load tasks')
    }

    setTasks(data.tasks || [])
  }

  async function loadAll(){
    try {
      setLoading(true)
      setError('')
      await Promise.all([loadProject(), loadTasks(), loadMembers()])
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [workspaceId, projectId])

  async function saveProject() {
    try {
      setSaving(true)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ name, description }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save project')
      }

      setProject((prev) =>
        prev
          ? {
              ...prev,
              name,
              description,
            }
          : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()

    try {
      setCreatingTask(true)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            priority: taskPriority,
            status: 'todo',
            assignedTo,
            dueDate: null,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create task')
      }

      setAssignedTo('')

      setTaskTitle('')
      setTaskDescription('')
      setTaskPriority('medium')
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreatingTask(false)
    }
  }

  async function updateTaskStatus(task: Task, status: Task['status']) {
    try {
      setBusyId(`status-${task.id}`)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ status }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task')
      }

      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, status } : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId('')
    }
  }

  async function deleteTask(taskId: string) {
    const ok = window.confirm('Delete this task?')
    if (!ok) return

    try {
      setBusyId(`delete-${taskId}`)
      setError('')

      const idToken = await getToken()

      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete task')
      }

      setTasks((prev) => prev.filter((item) => item.id !== taskId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyId('')
    }
  }

  if (loading) {
    return <main>Loading project...</main>
  }

  if (!project) {
    return <main>Project not found.</main>
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-sm text-gray-500">Project details</p>
        </div>

        <button
          onClick={() => router.push(`/dashboard/workspace/${workspaceId}/projects`)}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border bg-white p-5">
        <div>
          <label className="mb-2 block text-sm font-medium">Project name</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Description</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          onClick={saveProject}
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-5">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-gray-500">Track work inside this project</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            required
          />

          <textarea
            className="w-full rounded-lg border px-3 py-2"
            rows={3}
            placeholder="Task description"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />

          <select
            className="w-full rounded-lg border px-3 py-2"
            value={taskPriority}
            onChange={(e) =>
              setTaskPriority(e.target.value as 'low' | 'medium' | 'high')
            }
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>

          <select
            className="w-full rounded-lg border px-3 py-2"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name || member.email} {member.role ? `(${member.role})` : ''}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={creatingTask}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {creatingTask ? 'Creating...' : 'Add Task'}
          </button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks yet.</p>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {task.description || 'No description'}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {task.status}
                      </span>
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {task.status !== 'todo' && (
                      <button
                        onClick={() => updateTaskStatus(task, 'todo')}
                        disabled={busyId === `status-${task.id}`}
                        className="rounded-lg border px-3 py-2 text-xs"
                      >
                        Todo
                      </button>
                    )}

                    {task.status !== 'in_progress' && (
                      <button
                        onClick={() => updateTaskStatus(task, 'in_progress')}
                        disabled={busyId === `status-${task.id}`}
                        className="rounded-lg border px-3 py-2 text-xs"
                      >
                        In Progress
                      </button>
                    )}

                    {task.status !== 'done' && (
                      <button
                        onClick={() => updateTaskStatus(task, 'done')}
                        disabled={busyId === `status-${task.id}`}
                        className="rounded-lg border px-3 py-2 text-xs"
                      >
                        Done
                      </button>
                    )}

                    <button
                      onClick={() => deleteTask(task.id)}
                      disabled={busyId === `delete-${task.id}`}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}