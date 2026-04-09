import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type MemberItem = {
  id: string
  userId: string
  email: string
  name?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt?: unknown
}

export async function listMembers(workspaceId: string): Promise<MemberItem[]> {
  const ref = collection(db, 'workspaces', workspaceId, 'members')
  const q = query(ref, orderBy('role'))
  const snap = await getDocs(q)

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<MemberItem, 'id'>),
  }))
}