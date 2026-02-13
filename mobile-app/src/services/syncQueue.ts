import { QueueItem } from '../types/domain';

const queue: QueueItem[] = [];

export function enqueue(item: QueueItem): void {
  queue.push(item);
}

export function listQueue(): QueueItem[] {
  return [...queue];
}

export async function processQueue(syncFn: (item: QueueItem) => Promise<void>): Promise<void> {
  for (const item of queue) {
    if (item.status === 'SYNCED') continue;
    item.status = 'IN_FLIGHT';
    try {
      await syncFn(item);
      item.status = 'SYNCED';
    } catch (error) {
      item.attempts += 1;
      item.status = item.attempts >= 3 ? 'REQUIRES_REVIEW' : 'FAILED';
    }
  }
}
