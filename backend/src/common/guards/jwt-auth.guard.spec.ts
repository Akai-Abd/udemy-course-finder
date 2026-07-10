import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlacklistService } from '../../auth/token-blacklist.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let tokenBlacklist: jest.Mocked<Partial<TokenBlacklistService>>;

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    tokenBlacklist = {
      isBlacklisted: jest.fn().mockResolvedValue(false),
    };

    guard = new JwtAuthGuard(reflector, tokenBlacklist as any);
  });

  describe('canActivate', () => {
    it('should allow public routes without auth', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const user = { id: 'user-1', email: 'test@test.com' };
      const result = guard.handleRequest(null, user);
      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when no user', () => {
      expect(() => guard.handleRequest(null, false)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw original error when present', () => {
      const error = new Error('JWT expired');
      expect(() => guard.handleRequest(error, false)).toThrow(error);
    });
  });
});
