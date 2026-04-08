export interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived'
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}