export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  plan: 'free' | 'pro' | 'team'
  seats: number
  createdAt?: unknown
}

export interface WorkspaceMember {
  userId: string
  email: string
  name?: string
  role: WorkspaceRole
  joinedAt?: unknown
}