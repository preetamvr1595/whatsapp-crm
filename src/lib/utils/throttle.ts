/**
 * Throttle utility for rate-limiting message sends
 * Ensures we don't overwhelm the Meta API
 */

export class Throttle {
  private queue: (() => Promise<void>)[] = [];
  private running = 0;
  private maxConcurrent: number;
  private delayMs: number;
  private lastExecutionTime = 0;

  constructor(maxConcurrent: number = 3, delayMs: number = 500) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
  }

  /**
   * Add a task to the queue
   * Returns a promise that resolves when the task completes
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  /**
   * Process the queue
   */
  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();

    if (!task) {
      this.running--;
      return;
    }

    // Respect delay between sends
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;
    if (timeSinceLastExecution < this.delayMs) {
      await new Promise(resolve =>
        setTimeout(resolve, this.delayMs - timeSinceLastExecution)
      );
    }

    this.lastExecutionTime = Date.now();

    try {
      await task();
    } finally {
      this.running--;
      this.process();  // Process next item
    }
  }

  /**
   * Wait for all tasks to complete
   */
  async waitAll() {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.running === 0 && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}

/**
 * Create a throttled function
 */
export function createThrottledFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxConcurrent: number = 3,
  delayMs: number = 500
) {
  const throttle = new Throttle(maxConcurrent, delayMs);

  return {
    execute: (...args: T) => throttle.add(() => fn(...args)),
    waitAll: () => throttle.waitAll(),
  };
}

/**
 * Batch processor for dividing large arrays into chunks
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayBetweenBatches: number = 1000
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);

    // Delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}
