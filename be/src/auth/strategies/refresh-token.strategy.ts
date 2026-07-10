import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { TokenPayload } from '../interfaces/token-payload.interface';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req && req.cookies) {
            return req.cookies['refresh_token'] || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: TokenPayload) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }

    const storedHash = await this.authService.findRefreshTokenHash(payload.sub);
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const isValid = bcrypt.compareSync(refreshToken, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    return {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    };
  }
}
