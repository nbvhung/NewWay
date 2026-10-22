import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { User } from '../../database/entities/user.entity';
import { resolvePermissions } from '../../common/permissions/permissions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private redisService: RedisService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req && req.cookies) {
            return req.cookies['access_token'] || null;
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: TokenPayload) {
    const isBlacklisted = await this.redisService.isTokenBlacklisted(
      payload.jti || '',
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã bị vô hiệu hóa');
    }

    // Lấy quyền TƯƠI từ DB thay vì tin vào `permissions` đã nhúng trong token.
    // Nhờ vậy khi admin cấp/thu quyền cho tài khoản thì có hiệu lực NGAY ở
    // request kế tiếp (không phải chờ token 15 phút hết hạn / đăng nhập lại),
    // và tránh trường hợp token cũ thiếu quyền → 403 oan.
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || user.role === 'disabled') {
      throw new UnauthorizedException('Tài khoản không hợp lệ');
    }

    const visibleDriverIds = Array.isArray(user.visibleDriverIds)
      ? user.visibleDriverIds
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n))
      : null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      permissions: resolvePermissions(user),
      visibleDriverIds,
      jti: payload.jti,
    };
  }
}
