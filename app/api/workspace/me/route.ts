import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

export async function GET(req: NextRequest) {
  try {
    const uid = await getUidFromRequest(req)

    const membersSnap = await adminDb
      .collectionGroup('members')
      .where('userId', '==', uid)
      .get()

    const workspaces = await Promise.all(
      membersSnap.docs.map(async (memberDoc) => {
        const workspaceRef = memberDoc.ref.parent.parent
        if (!workspaceRef) return null

        const workspaceSnap = await workspaceRef.get()
        if (!workspaceSnap.exists) return null

        const memberData = memberDoc.data()
        const workspaceData = workspaceSnap.data()

        return {
          workspaceId: workspaceRef.id,
          role: memberData.role,
          name: workspaceData?.name ?? '',
          slug: workspaceData?.slug ?? '',
          ownerId: workspaceData?.ownerId ?? '',
        }
      })
    )

    return NextResponse.json({
      workspaces: workspaces.filter(Boolean),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}