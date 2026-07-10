import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class TokenBlacklistService implements OnModuleInit {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      keyPrefix: 'token:blacklist:',
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });

    this.redis.connect().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis connection for token blacklist failed: ${message}. Token blacklisting will be unavailable.`,
      );
    });
  }

  /**
   * Blacklist a JWT by its JTI (JWT ID).
   * The entry expires after `ttlSeconds` (matching the token's remaining lifetime).
   */
  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(jti, '1', 'EX', Math.max(ttlSeconds, 1));
      this.logger.debug(`Blacklisted token JTI: ${jti} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.error(`Failed to blacklist token JTI ${jti}: ${error}`);
    }
  }

  /**
   * Check if a JWT is blacklisted by its JTI.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await this.redis.get(jti);
      return result !== null;
    } catch (error) {
      this.logger.error(`Failed to check blacklist for JTI ${jti}: ${error}`);
      // Fail-open: if Redis is down, allow the request
      return false;
    }
  }
}
