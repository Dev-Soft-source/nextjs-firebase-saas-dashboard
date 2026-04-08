import { WorkspaceRole } from '@/types/workspace'

export function canManageMembers(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin'
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === 'owner'
}

export function canCreateProject(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin' || role === 'member'
}