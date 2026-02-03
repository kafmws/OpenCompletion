export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

export class DebouncedRequest<T, Args extends unknown[] = unknown[]> {
  private timeoutId: NodeJS.Timeout | undefined;
  private currentRequestId = 0;

  constructor(
    private fn: (...args: Args) => Promise<T>,
    private delay: number
  ) {}

  public async execute(...args: Args): Promise<T | null> {
    const requestId = ++this.currentRequestId;

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }

    return new Promise((resolve) => {
      this.timeoutId = setTimeout(async () => {
        if (requestId === this.currentRequestId) {
          try {
            const result = await this.fn(...args);
            if (requestId === this.currentRequestId) {
              resolve(result);
            } else {
              resolve(null);
            }
          } catch (error) {
            if (requestId === this.currentRequestId) {
              throw error;
            }
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }, this.delay);
    });
  }

  public cancel(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.currentRequestId++;
  }
}
