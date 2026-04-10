import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

type RouteContext = {
  params: Promise<{
    workspaceId: string
    projectId: string
  }>
}

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

function canManageProjects(role: string) {
  return ['owner', 'admin', 'member'].includes(role)
}

async function getUserRole(workspaceId: string, uid: string) {
  const memberRef = adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)

  const memberSnap = await memberRef.get()
  if (!memberSnap.exists) return null
  return memberSnap.data()?.role ?? null
}

async function getMember(workspaceId: string, uid: string) {
    const memberRef = adminDb.collection("workspaces").doc(workspaceId).collection("members").doc(uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return null;
    return memberSnap.data();
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId } = await context.params
    const uid = await getUidFromRequest(req)
    const member = await getMember(workspaceId, uid)

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .get()

    if (!snap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      project: {
        id: snap.id,
        ...snap.data(),
      },
    })
  } catch (error) {
    console.error('GET project failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}


export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId } = await context.params
    const uid = await getUidFromRequest(req)
    const member = await getMember(workspaceId, uid)

    if (!member || !canManageProjects(String(member.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    }

    if (typeof body.name === 'string') {
      updates.name = body.name.trim()
    }

    if (typeof body.description === 'string') {
      updates.description = body.description.trim()
    }

    if (typeof body.status === 'string' && ['active', 'archived'].includes(body.status)) {
      updates.status = body.status
    }

    await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .update(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH project failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId } = await context.params
    const uid = await getUidFromRequest(req)
    const role = await getUserRole(workspaceId, uid)

    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)

    const projectSnap = await projectRef.get()
    if (!projectSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await projectRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE project failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
