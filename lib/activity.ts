import { prisma } from '@/lib/db'

export async function createActivity(
  taskId: string,
  actor: string,
  action: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.taskActivity.create({
      data: {
        taskId,
        actor,
        action,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
  } catch (e) {
    console.error('[activity]', e)
  }
}
