import { suggestChangesForStudy } from './route';

export interface PrefillStreamCallbacks {
  /** Called for each tool step (human-readable) as it streams in. */
  onStep?: (step: string) => void;
  /** Called with incremental assistant text (the AI's prose / summary). */
  onContent?: (fullText: string) => void;
  /** Called once when the stream reports completion. */
  onComplete?: (info: { modifiedCohortIds: string[]; modifiedCohortNames: string[] }) => void;
  /** Called on a stream-level error event. */
  onError?: (message: string) => void;
}

export interface PrefillStreamResult {
  text: string;
  steps: string[];
  modifiedCohortIds: string[];
  modifiedCohortNames: string[];
}

/**
 * Run a single cohort's AI prefill as its own SSE stream, surfacing live tool steps and
 * the final assistant text via callbacks. Targets a specific cohort via active_cohort_id
 * so multiple cohorts can be prefilled in parallel, each on its own stream.
 */
export async function runCohortPrefill(
  studyId: string,
  cohortId: string,
  prompt: string,
  callbacks: PrefillStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<PrefillStreamResult> {
  const stream = await suggestChangesForStudy(
    studyId,
    prompt,
    'gpt-4o',
    [],
    undefined,
    cohortId,
    signal,
  );

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBuffer = '';
  const steps: string[] = [];
  const result: PrefillStreamResult = {
    text: '',
    steps,
    modifiedCohortIds: [],
    modifiedCohortNames: [],
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'content') {
          if (data.message) {
            textBuffer += data.message;
            callbacks.onContent?.(textBuffer);
          }
        } else if (data.type === 'tool_call') {
          if (data.message) {
            steps.push(data.message);
            callbacks.onStep?.(data.message);
          }
        } else if (data.type === 'tool_error') {
          if (data.message) {
            const step = `❌ ${data.message}`;
            steps.push(step);
            callbacks.onStep?.(step);
          }
        } else if (data.type === 'error') {
          callbacks.onError?.(data.message || 'Unknown error');
        } else if (data.type === 'complete') {
          result.modifiedCohortIds = data.modified_cohort_ids ?? [];
          result.modifiedCohortNames = data.modified_cohort_names ?? [];
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  result.text = textBuffer;
  callbacks.onComplete?.({
    modifiedCohortIds: result.modifiedCohortIds,
    modifiedCohortNames: result.modifiedCohortNames,
  });
  return result;
}

/**
 * Run async tasks with a bounded concurrency limit. Tasks are started in order but at
 * most `limit` run at once. Rejections are swallowed per-task (each task should handle
 * its own errors); the returned promise resolves when all tasks settle.
 */
export async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  let index = 0;
  const workers: Promise<void>[] = [];
  const runNext = async (): Promise<void> => {
    while (index < tasks.length) {
      const current = index++;
      try {
        await tasks[current]();
      } catch {
        // per-task errors are handled inside the task
      }
    }
  };
  const workerCount = Math.min(limit, tasks.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(runNext());
  }
  await Promise.all(workers);
}
