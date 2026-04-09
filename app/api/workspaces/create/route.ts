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
    const email = decoded.email?.toLowerCase() || ''

    const body = await req.json()
    const name = String(body.name || '').trim()

    if (!name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const userSnap = await adminDb.collection('users').doc(uid).get()
    const userData = userSnap.exists ? userSnap.data() : null

    const workspaceRef = adminDb.collection('workspaces').doc()
    const workspaceId = workspaceRef.id

    const batch = adminDb.batch()

    batch.set(workspaceRef, {
      name,
      slug: slugify(name),
      ownerId: uid,
      plan: 'free',
      seats: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    batch.set(workspaceRef.collection('members').doc(uid), {
      userId: uid,
      email,
      name: userData?.name || decoded.name || '',
      role: 'owner',
      rolePriority: 1,
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error) {
    console.error('POST /api/workspaces/create failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}