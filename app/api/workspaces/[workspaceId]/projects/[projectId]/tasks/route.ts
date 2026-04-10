import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
    projectId: string;
  }>;
};

async function getUidFromRequest(req: NextRequest) {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing authorization token");
    }

    const idToken = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
}   

async function getMember( workspaceId: string, uid: string) {
    const memberRef = adminDb.collection("workspaces").doc(workspaceId).collection("members").doc(uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return null;
    return memberSnap.data();
}

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const { workspaceId, projectId } = await context.params;
        const uid = await getUidFromRequest(req);
        const member = await getMember(workspaceId, uid);

        if (!member) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const projectRef = adminDb.collection("workspaces").doc(workspaceId).collection("projects").doc(projectId).collection("tasks").orderBy("createdAt", "desc");
        const projectSnap = await projectRef.get();

        const tasks = projectSnap.docs.map((doc) => {
            const data = doc.data();
            return {    
                id: doc.id,
                title: String(data.title || ""),
                description: String(data.description || ""),
                status: String(data.status || "active"),
                priority: String(data.priority || "medium"),
                assignedTo: String(data.assignedTo || ""),
                createdBy: String(data.createdBy || ""),
                dueDate: data.dueDate ? data.dueDate.toDate() : null,
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : null, 
            };
        });
        
        return NextResponse.json({ tasks });
    } catch (err) {
        console.error("Error fetching tasks:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const { workspaceId, projectId } = await context.params;
        const uid = await getUidFromRequest(req);
        const member = await getMember(workspaceId, uid);

        if (!member) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const title = String(body.title || "").trim();
        const description = String(body.description || "").trim();
        const status = String(body.status || "todo").trim();
        const priority = String(body.priority || "medium").trim();
        const assignedTo = String(body.assignedTo || "").trim();
        const dueDate = body.dueDate ? new Date(body.dueDate) : null;
        if (!title) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        if (!['todo', 'in_progress', 'done'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        if (!['low', 'medium', 'high'].includes(priority)) {
            return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
        }

        let assignedToName = ''
        let assignedToEmail = ''

        if (assignedTo) {
        const assignedMemberSnap = await adminDb
            .collection('workspaces')
            .doc(workspaceId)
            .collection('members')
            .doc(assignedTo)
            .get()

        if (!assignedMemberSnap.exists) {
            return NextResponse.json( { error: 'Assigned member not found in workspace' }, { status: 400 } )
        }

        const assignedMember = assignedMemberSnap.data()!
        assignedToName = assignedMember.name ?? ''
        assignedToEmail = assignedMember.email ?? ''
        }

        const ref = adminDb
            .collection('workspaces')
            .doc(workspaceId)
            .collection('projects')
            .doc(projectId)
            .collection('tasks')
            .doc()

        await ref.set({
            title,
            description,
            status,
            priority,
            assignedTo,
            assignedToName,
            assignedToEmail,
            createdBy: uid,
            createdAt: new Date(),
            updatedAt: new Date(),
            })

        return NextResponse.json({
        success: true,
        taskId: ref.id,
        })
    } catch (error) {
        console.error('POST task failed:', error)

        return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
        )
    }
}
