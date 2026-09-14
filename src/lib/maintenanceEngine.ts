import "server-only";
import { prisma } from "@/lib/prisma";
import { getPeriod, isTaskDueInPeriod, type MaintenanceFrequency } from "@/lib/maintenanceSchedule";
import type { Prisma } from "@prisma/client";

/**
 * Materializes (or fetches, if already created) today's MaintenanceExecution
 * row for every active task whose current period is due, flipping any
 * unfinished-but-overdue row to ATRASADA. Shared by /api/maintenance/today
 * (the technician's list) and /api/maintenance/stats (the dashboard counts)
 * so both agree on exactly which instances count as "due now".
 */
export async function getCurrentExecutions(where: Prisma.MaintenanceTaskWhereInput) {
  const now = new Date();

  const tasks = await prisma.maintenanceTask.findMany({
    where: { active: true, ...where },
    include: {
      plant: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      assignedUser: { select: { id: true, name: true, phone: true } },
    },
  });

  const dueTasks = tasks
    .map((task) => ({ task, period: getPeriod(task.frequency as MaintenanceFrequency, now) }))
    .filter(({ task, period }) => isTaskDueInPeriod(task.frequency as MaintenanceFrequency, task.scheduledMonths, period, now));

  const executions = await Promise.all(
    dueTasks.map(async ({ task, period }) => {
      const reviewerInclude = { reviewer: { select: { id: true, name: true } } } as const;
      let execution = await prisma.maintenanceExecution.findUnique({
        where: { taskId_periodKey: { taskId: task.id, periodKey: period.key } },
        include: reviewerInclude,
      });

      if (!execution) {
        execution = await prisma.maintenanceExecution.create({
          data: { taskId: task.id, periodKey: period.key, dueDate: period.dueDate, status: "PENDENTE" },
          include: reviewerInclude,
        });
      } else if (
        (execution.status === "PENDENTE" || execution.status === "EM_ANDAMENTO") &&
        now.getTime() > execution.dueDate.getTime()
      ) {
        execution = await prisma.maintenanceExecution.update({
          where: { id: execution.id },
          data: { status: "ATRASADA" },
          include: reviewerInclude,
        });
      }

      return { ...execution, task };
    })
  );

  executions.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return executions;
}
