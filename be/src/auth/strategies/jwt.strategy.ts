import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { TokenPayload } from '../interfaces/token-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private redisService: RedisService) {
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
    const isBlacklisted = await this.redisService.isTokenBlacklisted(payload.jti || '');
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã bị vô hiệu hóa');
    }
    return {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
