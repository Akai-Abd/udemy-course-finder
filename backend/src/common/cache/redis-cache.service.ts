import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      keyPrefix: 'cache:',
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });

    this.redis.connect().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis cache connection failed: ${message}. Caching will be unavailable.`,
      );
    });
  }

  /**
   * Get a cached value by key. Returns null if not found or on error.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a cached value with a TTL in seconds.
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}: ${error}`);
    }
  }

  /**
   * Invalidate (delete) a specific cache key.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Cache invalidate failed for key ${key}: ${error}`);
    }
  }

  /**
   * Invalidate all cache keys matching a pattern.
   * Uses SCAN to avoid blocking Redis.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({
        match: `cache:${pattern}`,
        count: 100,
      });

      const pipeline = this.redis.pipeline();
      let count = 0;

      for await (const keys of stream) {
        for (const key of keys as string[]) {
          // Remove the keyPrefix since pipeline uses the same connection
          const cleanKey = key.replace(/^cache:/, '');
          pipeline.del(cleanKey);
          count++;
        }
      }

      if (count > 0) {
        await pipeline.exec();
        this.logger.debug(
          `Invalidated ${count} cache keys matching ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Cache invalidatePattern failed for ${pattern}: ${error}`,
      );
    }
  }
}
