import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

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
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .get()

    const comments = snap.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        body: data.body ?? '',
        authorId: data.authorId ?? '',
        authorName: data.authorName ?? '',
        authorEmail: data.authorEmail ?? '',
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
      }
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('GET comments failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId, taskId } = await context.params
    const decoded = await getDecodedFromRequest(req)
    const member = await getMember(workspaceId, decoded.uid)

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bodyData = await req.json()
    const body = String(bodyData.body || '').trim()

    if (!body) {
      return NextResponse.json(
        { error: 'Comment body is required' },
        { status: 400 }
      )
    }

    const taskRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)

    const commentRef = taskRef.collection('comments').doc()
    const activityRef = taskRef.collection('activity').doc()

    await adminDb.runTransaction(async (tx) => {
      tx.set(commentRef, {
        body,
        authorId: decoded.uid,
        authorName: member?.name ?? decoded.name ?? '',
        authorEmail: member?.email ?? decoded.email ?? '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      tx.set(activityRef, {
        type: 'comment_added',
        message: 'added a comment',
        actorId: decoded.uid,
        actorName: member?.name ?? decoded.name ?? '',
        actorEmail: member?.email ?? decoded.email ?? '',
        createdAt: FieldValue.serverTimestamp(),
        meta: {
          commentId: commentRef.id,
        },
      })
    })

    return NextResponse.json({
      success: true,
      commentId: commentRef.id,
    })
  } catch (error) {
    console.error('POST comment failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}