export function taskSuggestPrompt(input: {
  title: string
  description: string
}) {
  return `
You are an expert SaaS project management assistant.

Improve the task so it is clearer, more actionable, and better structured.
Do not invent product facts that were not provided.
Keep the result concise and practical.

Original title:
${input.title}

Original description:
${input.description}
`.trim()
}

export function taskBreakdownPrompt(input: {
  title: string
  description: string
}) {
  return `
You are an expert project planner.

Break the task into small execution-ready subtasks.
Each subtask should be concrete and short.
Avoid duplicates.
Prefer 3 to 7 subtasks.

Task title:
${input.title}

Task description:
${input.description}
`.trim()
}

export function taskAssignPrompt(input: {
  title: string
  description: string
  priority: string
  members: Array<{
    userId: string
    name: string
    email: string
    role: string
  }>
}) {
  const membersText = input.members
    .map(
      (m, i) =>
        `${i + 1}. userId=${m.userId}, name=${m.name || 'Unknown'}, email=${m.email}, role=${m.role}`
    )
    .join('\n')

  return `
You are an expert team coordinator.

Choose the best member for this task based on title, description, and role.
Prefer the best fit role match.
If no strong fit exists, return the best general contributor.

Task title:
${input.title}

Task description:
${input.description}

Priority:
${input.priority}

Team members:
${membersText}
`.trim()
}