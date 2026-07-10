import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    return this.generateTokens(user);
  }

  async refresh(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    await this.redisService.removeRefreshToken(userId);
    return this.generateTokens(user);
  }

  async logout(userId: number, jti: string, accessTokenExp: number) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(0, accessTokenExp - now);
    if (ttl > 0) {
      await this.redisService.blacklistToken(jti, ttl);
    }
    await this.redisService.removeRefreshToken(userId);
  }

  private async generateTokens(user: User) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
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
        jti: refreshJti,
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    const refreshHash = bcrypt.hashSync(refreshToken, 10);
    await this.redisService.setRefreshToken(user.id, refreshHash);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
