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

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const taskRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .doc(projectId)
      .collection('tasks')
      .doc(taskId)

    const taskSnap = await taskRef.get()

    if (!taskSnap.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const currentTask = taskSnap.data() || {}
    const body = await req.json()

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    const activityEntries: Array<{
      type: string
      message: string
      meta?: Record<string, unknown>
    }> = []

    if (typeof body.title === 'string') {
      const nextTitle = body.title.trim()

      if (nextTitle !== (currentTask.title ?? '')) {
        updates.title = nextTitle
        activityEntries.push({
          type: 'task_title_changed',
          message: 'changed the task title',
          meta: {
            from: currentTask.title ?? '',
            to: nextTitle,
          },
        })
      }
    }

    if (typeof body.description === 'string') {
      const nextDescription = body.description.trim()

      if (nextDescription !== (currentTask.description ?? '')) {
        updates.description = nextDescription
        activityEntries.push({
          type: 'task_description_changed',
          message: 'updated the task description',
          meta: {
            from: currentTask.description ?? '',
            to: nextDescription,
          },
        })
      }
    }

    if (
      typeof body.status === 'string' &&
      ['todo', 'in_progress', 'done'].includes(body.status)
    ) {
      if (body.status !== currentTask.status) {
        updates.status = body.status
        activityEntries.push({
          type: 'task_status_changed',
          message: `changed status to ${body.status}`,
          meta: {
            from: currentTask.status ?? '',
            to: body.status,
          },
        })
      }
    }

    if (
      typeof body.priority === 'string' &&
      ['low', 'medium', 'high'].includes(body.priority)
    ) {
      if (body.priority !== currentTask.priority) {
        updates.priority = body.priority
        activityEntries.push({
          type: 'task_priority_changed',
          message: `changed priority to ${body.priority}`,
          meta: {
            from: currentTask.priority ?? '',
            to: body.priority,
          },
        })
      }
    }

    if (typeof body.assignedTo === 'string') {
      const assignedTo = body.assignedTo.trim()
      const currentAssignedTo = currentTask.assignedTo ?? ''

      if (assignedTo !== currentAssignedTo) {
        if (!assignedTo) {
          updates.assignedTo = ''
          updates.assignedToName = ''
          updates.assignedToEmail = ''

          activityEntries.push({
            type: 'task_unassigned',
            message: 'removed the task assignment',
            meta: {
              from: {
                assignedTo: currentTask.assignedTo ?? '',
                assignedToName: currentTask.assignedToName ?? '',
                assignedToEmail: currentTask.assignedToEmail ?? '',
              },
              to: null,
            },
          })
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

          activityEntries.push({
            type: 'task_assigned',
            message: assignedMember.name
              ? `assigned task to ${assignedMember.name}`
              : assignedMember.email
              ? `assigned task to ${assignedMember.email}`
              : 'updated task assignment',
            meta: {
              from: {
                assignedTo: currentTask.assignedTo ?? '',
                assignedToName: currentTask.assignedToName ?? '',
                assignedToEmail: currentTask.assignedToEmail ?? '',
              },
              to: {
                assignedTo,
                assignedToName: assignedMember.name ?? '',
                assignedToEmail: assignedMember.email ?? '',
              },
            },
          })
        }
      }
    }

    if (body.dueDate !== undefined) {
      const currentDueDate = currentTask.dueDate ?? null
      const nextDueDate = body.dueDate

      if (JSON.stringify(currentDueDate) !== JSON.stringify(nextDueDate)) {
        updates.dueDate = nextDueDate
        activityEntries.push({
          type: 'task_due_date_changed',
          message: 'updated the due date',
          meta: {
            from: currentDueDate,
            to: nextDueDate,
          },
        })
      }
    }

    if (activityEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
      })
    }

    await adminDb.runTransaction(async (tx) => {
      tx.update(taskRef, updates)

      for (const entry of activityEntries) {
        const activityRef = taskRef.collection('activity').doc()

        tx.set(activityRef, {
          type: entry.type,
          message: entry.message,
          actorId: uid,
          actorName: member?.name ?? '',
          actorEmail: member?.email ?? '',
          createdAt: FieldValue.serverTimestamp(),
          meta: entry.meta ?? {},
        })
      }
    })

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
