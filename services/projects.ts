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

// export async function createTask(
//   workspaceId: string,
//   projectId: string,
//   title: string,
//   description: string,
//   priority: 'low' | 'medium' | 'high',
//   assignedTo: string,
//   userId: string,
//   dueDate: Date | null
// ) {
//   const ref = collection(db, 'workspaces', workspaceId, 'projects', projectId, 'tasks')

//   return addDoc(ref, {
//     title,
//     description,
//     status: 'todo',
//     priority,
//     assignedTo,
//     dueDate,
//     createdBy: userId,
//     createdAt: serverTimestamp(),
//     updatedAt: serverTimestamp(),
//   })
// }