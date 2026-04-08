'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { listProjects, createProject } from '@/services/projects'
import { waitForAuth } from '@/lib/auth'

export default function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>()
  const workspaceId = params.workspaceId

  const [projects, setProjects] = useState<any[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function loadProjects() {
    const rows = await listProjects(workspaceId)
    setProjects(rows)
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

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-white p-4">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="rounded-lg bg-black px-4 py-2 text-white">
          Create project
        </button>
      </form>

      <div className="grid gap-4">
        {projects.map((project) => (
          <div key={project.id} className="rounded-xl border bg-white p-4">
            <h2 className="font-medium">{project.name}</h2>
            <p className="text-sm text-gray-600">{project.description}</p>
          </div>
        ))}
      </div>
    </main>
  )
}