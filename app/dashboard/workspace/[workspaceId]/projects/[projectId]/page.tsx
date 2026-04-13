'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  dueDate?: string | null
  createdBy?: string
  createdAt?: { seconds?: number; _seconds?: number } | null
  updatedAt?: { seconds?: number; _seconds?: number } | null
}

type MemberOption = {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

type ActivityItem = {
  id: string
  type: string
  message: string
  actorId?: string
  actorName?: string
  actorEmail?: string
  createdAt?: { seconds?: number; _seconds?: number } | null
  meta?: Record<string, unknown>
}

function formatTimestamp(
  value?: { seconds?: number; _seconds?: number } | null
) {
  const seconds = value?.seconds ?? value?._seconds
  if (!seconds) return '—'
  return new Date(seconds * 1000).toLocaleString()
}

function statusLabel(status: Task['status']) {
  if (status === 'in_progress') return 'In Progress'
  if (status === 'done') return 'Done'
  return 'Todo'
}

function priorityLabel(priority: Task['priority']) {
  if (priority === 'high') return 'High'
  if (priority === 'low') return 'Low'
  return 'Medium'
}

export default function ProjectDetailsPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>()
  const router = useRouter()
  const { workspaceId, projectId } = params

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>(
    'medium'
  )
  const [assignedTo, setAssignedTo] = useState('')

  const [selectedTaskId, setSelectedTaskId] = useState('')

  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const [suggesting, setSuggesting] = useState(false)
  const [breakingDown, setBreakingDown] = useState(false)
  const [assigningAI, setAssigningAI] = useState(false)
  const [aiAssignReason, setAiAssignReason] = useState('')

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  )

  async function getToken() {
    const user = auth.currentUser
    if (!user) {
      router.push('/login')
      throw new Error('Not authenticated')
    }
    return user.getIdToken()
  }

  async function fetchJson(
    url: string,
    init?: RequestInit,
    customToken?: string
  ) {
    const idToken = customToken || (await getToken())

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${idToken}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Request failed')
    }

    return data
  }

  async function loadMembers(token?: string) {
    const data = await fetchJson(
      `/api/workspaces/${workspaceId}/members/options`,
      undefined,
      token
    )
    setMembers(data.members || [])
  }

  async function loadProject(token?: string) {
    const data = await fetchJson(
      `/api/workspaces/${workspaceId}/projects/${projectId}`,
      undefined,
      token
    )

    setProject(data.project)
    setName(data.project.name || '')
    setDescription(data.project.description || '')
  }

  async function loadTasks(token?: string) {
    const data = await fetchJson(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      undefined,
      token
    )

    const nextTasks = data.tasks || []
    setTasks(nextTasks)

    if (!selectedTaskId && nextTasks.length > 0) {
      setSelectedTaskId(nextTasks[0].id)
    }

    if (
      selectedTaskId &&
      !nextTasks.some((task: Task) => task.id === selectedTaskId)
    ) {
      setSelectedTaskId(nextTasks[0]?.id || '')
    }
  }

  async function loadActivity(taskId: string, token?: string) {
    if (!taskId) {
      setActivity([])
      return
    }

    const data = await fetchJson(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/activity`,
      undefined,
      token
    )

    setActivity(data.activity || [])
  }

  async function loadAll() {
    try {
      setLoading(true)
      setError('')

      const token = await getToken()

      await Promise.all([
        loadProject(token),
        loadTasks(token),
        loadMembers(token),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [workspaceId, projectId])

  useEffect(() => {
    if (!selectedTaskId) {
      setActivity([])
      return
    }

    ;(async () => {
      try {
        setError('')
        await loadActivity(selectedTaskId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })()
  }, [selectedTaskId])

  async function saveProject() {
    try {
      setSavingProject(true)
      setError('')

      await fetchJson(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      })

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
      setSavingProject(false)
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault()

    try {
      setCreatingTask(true)
      setError('')

      const data = await fetchJson(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

      setTaskTitle('')
      setTaskDescription('')
      setTaskPriority('medium')
      setAssignedTo('')

      await loadTasks()

      if (data.taskId) {
        setSelectedTaskId(data.taskId)
        await loadActivity(data.taskId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreatingTask(false)
    }
  }

  async function updateTaskStatus(task: Task, status: Task['status']) {
    try {
      setBusyKey(`status-${task.id}`)
      setError('')

      await fetchJson(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      )

      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status,
              }
            : item
        )
      )

      setSelectedTaskId(task.id)
      await loadActivity(task.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  async function updateTaskAssignment(taskId: string, nextAssignedTo: string) {
    try {
      setBusyKey(`assign-${taskId}`)
      setError('')

      await fetchJson(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ assignedTo: nextAssignedTo }),
        }
      )

      const selected = members.find((m) => m.userId === nextAssignedTo)

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                assignedTo: nextAssignedTo,
                assignedToName: selected?.name || '',
                assignedToEmail: selected?.email || '',
              }
            : task
        )
      )

      setSelectedTaskId(taskId)
      await loadActivity(taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  async function deleteTask(taskId: string) {
    const ok = window.confirm('Delete this task?')
    if (!ok) return

    try {
      setBusyKey(`delete-${taskId}`)
      setError('')

      await fetchJson(
        `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
        {
          method: 'DELETE',
        }
      )

      const remaining = tasks.filter((item) => item.id !== taskId)
      setTasks(remaining)

      if (selectedTaskId === taskId) {
        const nextTaskId = remaining[0]?.id || ''
        setSelectedTaskId(nextTaskId)
        if (nextTaskId) {
          await loadActivity(nextTaskId)
        } else {
          setActivity([])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  async function suggestTaskWithAI() {
    try {
      setSuggesting(true)
      setError('')

      const res = await fetch('/api/ai/task-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI suggestion')
      }

      setTaskTitle(data.result.title || taskTitle)
      setTaskDescription(data.result.description || taskDescription)
      setTaskPriority(data.result.priority || taskPriority)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSuggesting(false)
    }
  }

  async function autoAssignWithAI() {
    try {
      setAssigningAI(true)
      setError('')
      setAiAssignReason('')

      const res = await fetch('/api/ai/task-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          priority: taskPriority,
          members,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto assign task')
      }

      setAssignedTo(data.result.assignedTo || '')
      setAiAssignReason(data.result.reason || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAssigningAI(false)
    }
  }

  async function breakdownTaskWithAI() {
    try {
      setBreakingDown(true)
      setError('')

      const res = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to break down task')
      }

      const subtasks = data.result.subtasks || []

      const lines = subtasks.map(
        (item: { title: string; description: string }) =>
          `• ${item.title}${item.description ? ` — ${item.description}` : ''}`
      )

      setTaskDescription((prev) =>
        [prev, '', 'Suggested subtasks:', ...lines].filter(Boolean).join('\n')
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBreakingDown(false)
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
          onClick={() =>
            router.push(`/dashboard/workspace/${workspaceId}/projects`)
          }
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
          disabled={savingProject}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {savingProject ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-5">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-gray-500">Track work inside this project</p>
        </div>

        <form onSubmit={createTask} className="space-y-3">
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
                {member.name || member.email}
                {member.role ? ` (${member.role})` : ''}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={suggestTaskWithAI}
              disabled={suggesting}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              {suggesting ? 'Thinking...' : 'AI Suggest'}
            </button>

            <button
              type="button"
              onClick={autoAssignWithAI}
              disabled={assigningAI}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              {assigningAI ? 'Assigning...' : 'AI Assign'}
            </button>

            <button
              type="button"
              onClick={breakdownTaskWithAI}
              disabled={breakingDown}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              {breakingDown ? 'Breaking down...' : 'AI Breakdown'}
            </button>
          </div>

          {aiAssignReason && (
            <p className="text-sm text-gray-600">
              AI reason: {aiAssignReason}
            </p>
          )}

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
            {tasks.map((task) => {
              const isSelected = task.id === selectedTaskId

              return (
                <div
                  key={task.id}
                  className={`rounded-xl border p-4 ${
                    isSelected ? 'border-black' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {task.description || 'No description'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border px-2 py-1 text-xs">
                          {statusLabel(task.status)}
                        </span>

                        <span className="rounded-full border px-2 py-1 text-xs">
                          {priorityLabel(task.priority)}
                        </span>

                        <span className="rounded-full border px-2 py-1 text-xs">
                          Assigned:{' '}
                          {task.assignedToName ||
                            task.assignedToEmail ||
                            'Unassigned'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <select
                        className="rounded-lg border px-2 py-2 text-xs"
                        value={task.assignedTo || ''}
                        onChange={(e) =>
                          updateTaskAssignment(task.id, e.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.name || member.email}
                          </option>
                        ))}
                      </select>

                      {task.status !== 'todo' && (
                        <button
                          onClick={() => updateTaskStatus(task, 'todo')}
                          disabled={busyKey === `status-${task.id}`}
                          className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
                        >
                          Todo
                        </button>
                      )}

                      {task.status !== 'in_progress' && (
                        <button
                          onClick={() => updateTaskStatus(task, 'in_progress')}
                          disabled={busyKey === `status-${task.id}`}
                          className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
                        >
                          In Progress
                        </button>
                      )}

                      {task.status !== 'done' && (
                        <button
                          onClick={() => updateTaskStatus(task, 'done')}
                          disabled={busyKey === `status-${task.id}`}
                          className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
                        >
                          Done
                        </button>
                      )}

                      <button
                        onClick={() => deleteTask(task.id)}
                        disabled={busyKey === `delete-${task.id}`}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-5">
        <div>
          <h3 className="text-lg font-semibold">Activity</h3>
          <p className="text-sm text-gray-500">
            {selectedTask
              ? `Recent history for "${selectedTask.title}"`
              : 'Select a task to view activity'}
          </p>
        </div>

        {!selectedTask ? (
          <p className="text-sm text-gray-500">No task selected.</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet.</p>
        ) : (
          <div className="grid gap-3">
            {activity.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">
                    {item.actorName || item.actorEmail || 'System'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(item.createdAt)}
                  </p>
                </div>

                <p className="mt-2 text-sm text-gray-700">
                  <span className="font-medium">
                    {item.actorName || item.actorEmail || 'System'}
                  </span>{' '}
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}