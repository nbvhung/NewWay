import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { RedisService } from '../redis/redis.service';
import { resolvePermissions } from '../common/permissions/permissions';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async login(username: string, password: string) {
    const failKey = `login_fail:${username}`;
    const failCount = parseInt((await this.redisService.get(failKey)) || '0', 10);
    if (failCount >= this.MAX_LOGIN_FAILS) {
      throw new UnauthorizedException(
        'Tài khoản bị tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      );
    }

    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) {
      await this.registerLoginFail(failKey);
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      await this.registerLoginFail(failKey);
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (user.role === 'disabled') {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    await this.redisService.del(failKey);
    return this.generateTokens(user);
  }

  private readonly MAX_LOGIN_FAILS = 5;
  private readonly LOGIN_LOCK_TTL = 15 * 60;

  private async registerLoginFail(key: string): Promise<void> {
    await this.redisService.incr(key, this.LOGIN_LOCK_TTL);
  }

  async refresh(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    if (user.role === 'disabled') {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    await this.clearRefreshTokens(userId);
    return this.generateTokens(user);
  }

  async logout(userId: number, jti: string, accessTokenExp: number) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(0, accessTokenExp - now);
    if (ttl > 0) {
      await this.redisService.blacklistToken(jti, ttl);
    }
    await this.clearRefreshTokens(userId);
  }

  verifyRefreshToken(token: string): { sub: number } {
    try {
      return this.jwtService.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async findRefreshTokenHash(userId: number): Promise<string | null> {
    const cached = await this.redisService.getRefreshToken(userId);
    if (cached) return cached;

    const oldest = await this.refreshTokenRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (!oldest) return null;

    await this.redisService.setRefreshToken(userId, oldest.tokenHash);
    return oldest.tokenHash;
  }

  private async clearRefreshTokens(userId: number) {
    await this.redisService.removeRefreshToken(userId);
    await this.refreshTokenRepository.delete({ userId });
  }

  private async generateTokens(user: User) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const permissions = resolvePermissions(user);

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions,
        visibleDriverIds: user.visibleDriverIds,
        jti: accessJti,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions,
        visibleDriverIds: user.visibleDriverIds,
        jti: refreshJti,
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    const refreshHash = bcrypt.hashSync(refreshToken, 10);

    await Promise.all([
      this.redisService.setRefreshToken(user.id, refreshHash),
      this.refreshTokenRepository.save(
        this.refreshTokenRepository.create({ userId: user.id, tokenHash: refreshHash }),
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: resolvePermissions(user),
        visibleDriverIds: user.visibleDriverIds,
      },
    };
  }
}
