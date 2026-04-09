import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function getDecodedToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  return adminAuth.verifyIdToken(idToken)
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await getDecodedToken(req)
    const uid = decoded.uid

    const body = await req.json()

    const inviteFlow = Boolean(body.inviteFlow)
    const name = String(body.name || '').trim()
    const email = String(body.email || decoded.email || '')
      .trim()
      .toLowerCase()
    const workspaceName = String(body.workspaceName || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!inviteFlow && !workspaceName) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()

    const priorWorkspaceIds =
      (userSnap.data()?.workspaceIds as string[] | undefined) ?? []
    let workspaceId: string | null = priorWorkspaceIds[0] ?? null

    const batch = adminDb.batch()
    let createdNewWorkspace = false

    if (!workspaceId && !inviteFlow) {
      const workspaceRef = adminDb.collection('workspaces').doc()
      workspaceId = workspaceRef.id
      createdNewWorkspace = true

      batch.set(workspaceRef, {
        name: workspaceName || 'Workspace',
        slug: slugify(workspaceName || 'workspace'),
        ownerId: uid,
        plan: 'free',
        seats: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      batch.set(workspaceRef.collection('members').doc(uid), {
        userId: uid,
        email,
        name,
        role: 'owner',
        rolePriority: 1,
        joinedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    if (!userSnap.exists) {
      batch.set(userRef, {
        uid,
        name,
        email,
        photoURL: decoded.picture || null,
        workspaceIds: workspaceId ? [workspaceId] : [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      const updateFields: Record<string, unknown> = {
        name,
        email,
        photoURL: decoded.picture || null,
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (createdNewWorkspace) {
        updateFields.workspaceIds = FieldValue.arrayUnion(workspaceId!)
      }
      batch.update(userRef, updateFields)
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      uid,
      workspaceId,
    })
  } catch (error) {
    console.error('POST /api/signup failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}