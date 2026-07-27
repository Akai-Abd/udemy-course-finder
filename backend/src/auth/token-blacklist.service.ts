import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis: Redis | null = null;
  private readonly memoryBlacklist = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Clean up expired entries every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);

    if (process.env.ENABLE_REDIS === 'false') {
      this.logger.log('Redis is disabled. Using in-memory token blacklist.');
      return;
    }

    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    try {
      const client = new Redis(redisUrl, {
        keyPrefix: 'token:blacklist:',
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
          this.logger.log('✅ Connected to Redis for token blacklist');
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Redis connection failed: ${message}. Using in-memory token blacklist fallback.`,
          );
        });
    } catch {
      this.logger.warn('Using in-memory token blacklist fallback.');
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Blacklist a JWT by its JTI (JWT ID).
   */
  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + Math.max(ttlSeconds, 1) * 1000;
    this.memoryBlacklist.set(jti, expiresAt);

    if (this.redis) {
      try {
        await this.redis.set(jti, '1', 'EX', Math.max(ttlSeconds, 1));
      } catch (error) {
        this.logger.warn(`Redis blacklist set failed, stored in memory: ${error}`);
      }
    }
    this.logger.debug(`Blacklisted token JTI: ${jti} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Check if a JWT is blacklisted by its JTI.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const expiresAt = this.memoryBlacklist.get(jti);
    if (expiresAt) {
      if (Date.now() < expiresAt) {
        return true;
      }
      this.memoryBlacklist.delete(jti);
    }

    if (this.redis) {
      try {
        const result = await this.redis.get(jti);
        return result !== null;
      } catch {
        return false;
      }
    }
    return false;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.memoryBlacklist) {
      if (now >= expiresAt) {
        this.memoryBlacklist.delete(jti);
      }
    }
  }
}
