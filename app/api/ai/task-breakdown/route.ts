import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { taskBreakdownPrompt } from '@/lib/ai-prompts'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    const description = String(body.description || '').trim()

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
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
          content: taskBreakdownPrompt({ title, description }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_breakdown',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              subtasks: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    priority: {
                      type: 'string',
                      enum: ['low', 'medium', 'high'],
                    },
                  },
                  required: ['title', 'description', 'priority'],
                },
              },
            },
            required: ['subtasks'],
          },
        },
      },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('POST /api/ai/task-breakdown failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    )
  }
}