import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

type RouteContext = {
  params: Promise<{
    workspaceId: string
    memberId: string
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

async function getMemberData(workspaceId: string, uid: string) {
  const snap = await adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)
    .get()

  return snap.exists ? snap.data() : null
}

function getRolePriority(role: string) {
  if (role === 'owner') return 1
  if (role === 'admin') return 2
  return 3
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, memberId } = await context.params
    const uid = await getUidFromRequest(req)
    const actor = await getMemberData(workspaceId, uid)

    if (!actor || !['owner', 'admin'].includes(String(actor.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const nextRole = String(body.role || '').trim()

    if (!['admin', 'member'].includes(nextRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const targetRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(memberId)

    const targetSnap = await targetRef.get()

    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const target = targetSnap.data()!

    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'Owner role cannot be changed' },
        { status: 400 }
      )
    }

    if (uid === memberId && nextRole !== 'admin' && actor.role === 'admin') {
      return NextResponse.json(
        { error: 'Admin cannot demote themselves here' },
        { status: 400 }
      )
    }

    await targetRef.update({
      role: nextRole,
      rolePriority: getRolePriority(nextRole),
      updatedAt: new Date(),
      updatedBy: uid,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH member failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, memberId } = await context.params
    const uid = await getUidFromRequest(req)
    const actor = await getMemberData(workspaceId, uid)

    if (!actor || !['owner', 'admin'].includes(String(actor.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(memberId)

    const targetSnap = await targetRef.get()

    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const target = targetSnap.data()!

    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'Owner cannot be removed' },
        { status: 400 }
      )
    }

    if (uid === memberId) {
      return NextResponse.json(
        { error: 'Use a separate leave-workspace flow for yourself' },
        { status: 400 }
      )
    }

    await targetRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE member failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}