import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;
  private readonly memoryCache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Clean up expired entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(
      () => this.cleanupExpired(),
      5 * 60 * 1000,
    );

    if (process.env.ENABLE_REDIS === 'false') {
      this.logger.log('Redis is disabled. Using in-memory cache.');
      return;
    }

    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    try {
      const client = new Redis(redisUrl, {
        keyPrefix: 'cache:',
        lazyConnect: true,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      });

      client.on('error', () => {
        // Silent error handler to catch ioredis reconnection error events
      });

      client
        .connect()
        .then(() => {
          this.redis = client;
          this.logger.log('✅ Connected to Redis for caching');
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Redis connection failed: ${message}. Using in-memory cache fallback.`,
          );
        });
    } catch {
      this.logger.warn('Using in-memory cache fallback.');
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get a cached value by key. Returns null if not found or on error.
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.value as T;
      }
      this.memoryCache.delete(key);
    }

    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Set a cached value with a TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + Math.max(ttlSeconds, 1) * 1000;
    this.memoryCache.set(key, { value, expiresAt });

    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (error) {
        this.logger.warn(`Redis cache set failed for key ${key}: ${error}`);
      }
    }
  }

  /**
   * Invalidate (delete) a specific cache key.
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        this.logger.warn(
          `Redis cache invalidate failed for key ${key}: ${error}`,
        );
      }
    }
  }

  /**
   * Invalidate all cache keys matching a pattern.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const cleanPattern = pattern.replace(/\*/g, '');
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.includes(cleanPattern)) {
        this.memoryCache.delete(key);
      }
    }

    if (this.redis) {
      try {
        const stream = this.redis.scanStream({
          match: `cache:${pattern}`,
          count: 100,
        });

        const pipeline = this.redis.pipeline();
        let count = 0;

        for await (const keys of stream) {
          for (const key of keys as string[]) {
            const cleanKey = key.replace(/^cache:/, '');
            pipeline.del(cleanKey);
            count++;
          }
        }

        if (count > 0) {
          await pipeline.exec();
        }
      } catch (error) {
        this.logger.warn(
          `Redis cache invalidatePattern failed for ${pattern}: ${error}`,
        );
      }
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }
}
