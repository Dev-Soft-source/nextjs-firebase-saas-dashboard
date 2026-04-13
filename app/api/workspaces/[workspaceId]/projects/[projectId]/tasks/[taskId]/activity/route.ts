import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

type RouteContext = {
  params: Promise<{
    workspaceId: string
    projectId: string
    taskId: string
  }>
}

async function getDecodedFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  return adminAuth.verifyIdToken(idToken)
}

async function getMember(workspaceId: string, uid: string) {
  const snap = await adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)
    .get()

  return snap.exists ? snap.data() : null
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId, taskId } = await context.params
    const decoded = await getDecodedFromRequest(req)
    const member = await getMember(workspaceId, decoded.uid)

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)
      .collection('activity')
      .orderBy('createdAt', 'desc')
      .get()

    const activity = snap.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type ?? '',
        message: data.message ?? '',
        actorId: data.actorId ?? '',
        actorName: data.actorName ?? '',
        actorEmail: data.actorEmail ?? '',
        createdAt: data.createdAt ?? null,
        meta: data.meta ?? {},
      }
    })

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('GET activity failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}