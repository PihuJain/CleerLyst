export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<boolean>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count++;

    if (entry.count > limit) {
      return false;
    }

    return true;
  }
}

export const rateLimiter = new MemoryRateLimiter();
