import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { LoginDto, TokenResponseDto, RegisterDto } from './dto';
import { TokenBlacklistService } from './token-blacklist.service';
import type { StringValue } from 'ms';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User ${user.email} logged in`);
    return this.generateTokens(user.id, user.email, user.role);
  }

  async register(registerDto: RegisterDto): Promise<TokenResponseDto> {
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(registerDto.password);
    const user = await this.usersService.create(registerDto.email, passwordHash, 'USER');

    this.logger.log(`User ${user.email} registered`);
    return this.generateTokens(user.id, user.email, user.role);
  }

  async refreshTokens(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _refreshToken: string,
  ): Promise<TokenResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    this.logger.log(`Token refreshed for user ${user.email}`);
    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(bearerToken: string): Promise<{ message: string }> {
    try {
      const decoded: JwtPayload | null = this.jwtService.decode(bearerToken);

      if (decoded?.jti && decoded?.exp) {
        const remainingTtl = decoded.exp - Math.floor(Date.now() / 1000);
        if (remainingTtl > 0) {
          await this.tokenBlacklist.blacklist(decoded.jti, remainingTtl);
          this.logger.log(`Token blacklisted on logout (JTI: ${decoded.jti})`);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to blacklist token on logout: ${error}`);
    }

    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const isCurrentValid = await argon2.verify(
      user.passwordHash,
      currentPassword,
    );

    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await argon2.hash(newPassword);
    await this.usersService.updatePassword(userId, newHash);

    this.logger.log(`Password changed for user ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenResponseDto> {
    const jti = uuidv4();
    const payload = { sub: userId, email, role, jti };

    const accessExpiry = (this.configService.get<string>('JWT_EXPIRY') ??
      '15m') as StringValue;
    const refreshExpiry = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRY',
    ) ?? '7d') as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessExpiry,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
