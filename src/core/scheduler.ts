import cron from "node-cron";
import { runFlow } from "./engine.js";
import { listFlows } from "./registry.js";

const activeTasks = new Map<string, ReturnType<typeof cron.schedule>>();

// Flow 생성/삭제 시 호출해서 활성 스케줄을 DB 상태와 다시 맞춥니다.
export async function refreshScheduler(): Promise<void> {
  for (const task of activeTasks.values()) task.stop();
  activeTasks.clear();

  const flows = await listFlows();
  for (const flow of flows) {
    if (!flow.schedule) continue;
    if (!cron.validate(flow.schedule)) {
      console.warn(`[scheduler] 잘못된 cron 표현식이라 건너뜁니다: flow="${flow.name}" schedule="${flow.schedule}"`);
      continue;
    }
    const task = cron.schedule(flow.schedule, () => {
      runFlow(flow).catch((err) => {
        console.error(`[scheduler] flow 실행 중 오류: ${flow.name}`, err);
      });
    });
    activeTasks.set(flow.id, task);
  }
}

export function activeScheduleCount(): number {
  return activeTasks.size;
}
