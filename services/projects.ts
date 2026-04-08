import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function createProject(
  workspaceId: string,
  name: string,
  description: string,
  userId: string
) {
  const ref = collection(db, 'workspaces', workspaceId, 'projects')

  return addDoc(ref, {
    name,
    description,
    status: 'active',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function listProjects(workspaceId: string) {
  const ref = collection(db, 'workspaces', workspaceId, 'projects')
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')))
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}