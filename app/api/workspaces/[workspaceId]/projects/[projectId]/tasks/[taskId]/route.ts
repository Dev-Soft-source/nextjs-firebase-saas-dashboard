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

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

async function getMember(workspaceId: string, uid: string) {
  const memberRef = adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)
  const memberSnap = await memberRef.get()
  if (!memberSnap.exists) return null
  return memberSnap.data()
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId, taskId } = await context.params
    const uid = await getUidFromRequest(req)
    const member = await getMember(workspaceId, uid)
    console.log('Member role:', member?.role)
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (typeof body.title === 'string') {
      updates.title = body.title.trim()
    }

    if (typeof body.description === 'string') {
      updates.description = body.description.trim()
    }

    if (
      typeof body.status === 'string' &&
      ['todo', 'in_progress', 'done'].includes(body.status)
    ) {
      updates.status = body.status
    }

    if (
      typeof body.priority === 'string' &&
      ['low', 'medium', 'high'].includes(body.priority)
    ) {
      updates.priority = body.priority
    }

    if (typeof body.assignedTo === 'string') {
      const assignedTo = body.assignedTo.trim()

      if (!assignedTo) {
        updates.assignedTo = ''
        updates.assignedToName = ''
        updates.assignedToEmail = ''
      } else {
        const assignedMemberSnap = await adminDb
          .collection('workspaces')
          .doc(workspaceId)
          .collection('members')
          .doc(assignedTo)
          .get()

        if (!assignedMemberSnap.exists) {
          return NextResponse.json(
            { error: 'Assigned member not found in workspace' },
            { status: 400 }
          )
        }

        const assignedMember = assignedMemberSnap.data()!

        updates.assignedTo = assignedTo
        updates.assignedToName = assignedMember.name ?? ''
        updates.assignedToEmail = assignedMember.email ?? ''
      }
    }

    if (body.dueDate !== undefined) {
      updates.dueDate = body.dueDate
    }

    await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)
      .update(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH task failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, projectId, taskId } = await context.params
    const uid = await getUidFromRequest(req)
    const member = await getMember(workspaceId, uid)

    if (!member || !['owner', 'admin'].includes(String(member.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)
      .delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE task failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
