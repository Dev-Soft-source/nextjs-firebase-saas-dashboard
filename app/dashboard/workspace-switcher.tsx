'use client'

import { useRouter } from 'next/navigation'

type WorkspaceItem = {
  workspaceId: string
  name: string
}

type Props = {
  items: WorkspaceItem[]
  currentWorkspaceId?: string
}

export default function WorkspaceSwitcher({
  items,
  currentWorkspaceId,
}: Props) {
  const router = useRouter()

  return (
    <select
      className="rounded-lg border px-3 py-2"
      value={currentWorkspaceId || ''}
      onChange={(e) =>
        router.push(`/dashboard/workspace/${e.target.value}`)
      }
    >
      <option value="" disabled>
        Select workspace
      </option>

      {items.map((item) => (
        <option key={item.workspaceId} value={item.workspaceId}>
          {item.name}
        </option>
      ))}
    </select>
  )
}