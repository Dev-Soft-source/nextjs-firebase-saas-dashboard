import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { taskAssignPrompt } from '@/lib/ai-prompts'

type MemberInput = {
  userId: string
  name: string
  email: string
  role: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const title = String(body.title || '').trim()
    const description = String(body.description || '').trim()
    const priority = String(body.priority || 'medium').trim()
    const members = Array.isArray(body.members)
      ? (body.members as MemberInput[])
      : []

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      )
    }

    if (!members.length) {
      return NextResponse.json(
        { error: 'Members are required' },
        { status: 400 }
      )
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'developer',
          content:
            'Return only valid JSON matching the provided schema.',
        },
        {
          role: 'user',
          content: taskAssignPrompt({
            title,
            description,
            priority,
            members,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_assignment',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              assignedTo: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['assignedTo', 'reason'],
          },
        },
      },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('POST /api/ai/task-assign failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    )
  }
}