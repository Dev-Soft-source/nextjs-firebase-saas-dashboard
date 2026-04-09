'use client'

import NavLink from '@/components/ui/nav-link'

import {
    LayoutDashboard,
    Folder,
    Users,
    Mail,
    Settings,
  } from 'lucide-react'

type WorkspaceInfo = {
  workspaceId: string
  role: string
  name: string
  slug: string
  ownerId: string
  plan: string
}

type Props = {
  workspaceId: string
  workspace: WorkspaceInfo | null
}

export default function Sidebar({ workspaceId, workspace }: Props) {

  return (
    <aside className="border-r bg-white">
      <div className="border-b p-5">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          Workspace
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          {workspace?.name || 'Workspace'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Role: {workspace?.role || 'member'}
        </p>
        <p className="text-sm text-gray-500">
          Plan: {workspace?.plan || 'free'}
        </p>
      </div>

      <nav className="space-y-1 p-3">
        <NavLink
            href={`/dashboard/workspace/${workspaceId}`}
            exact
            icon={<LayoutDashboard size={16} />}
            >
            Overview
        </NavLink>

        <NavLink
            href={`/dashboard/workspace/${workspaceId}/projects`}
            icon={<Folder size={16} />}
            >
            Projects
        </NavLink>

            <NavLink
            href={`/dashboard/workspace/${workspaceId}/members`}
            icon={<Users size={16} />}
            >
            Members
        </NavLink>

        {['owner', 'admin'].includes(workspace?.role ?? '') && (
          <NavLink
            href={`/dashboard/workspace/${workspaceId}/members/invites`}
            icon={<Mail size={16} />}
          >
            Invites
          </NavLink>
        )}

        <NavLink
            href={`/dashboard/workspace/${workspaceId}/settings`}
            icon={<Settings size={16} />}
            >
            Settings
        </NavLink>
      </nav>
    </aside>
  )
}