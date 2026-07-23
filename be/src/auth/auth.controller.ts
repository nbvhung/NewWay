import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.username, dto.password);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('mobile-login')
  @HttpCode(200)
  async mobileLogin(@Body() dto: MobileLoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('mobile-refresh')
  @HttpCode(200)
  async mobileRefresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new UnauthorizedException('Refresh token không được để trống');
    }
    const payload = this.authService.verifyRefreshToken(body.refreshToken);
    const storedHash = await this.authService.findRefreshTokenHash(payload.sub);
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    const isValid = bcrypt.compareSync(body.refreshToken, storedHash);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    return this.authService.refresh(payload.sub);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as any;
    const result = await this.authService.refresh(user.id);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: any,
  ) {
    const token = this.extractToken(req);
    let jti = '';
    let exp = 0;
    if (token) {
      try {
        const decoded = this.decodeToken(token);
        jti = decoded.jti || '';
        exp = decoded.exp || 0;
      } catch {}
    }
    await this.authService.logout(user.id, jti, exp);
    this.clearTokenCookies(res);
    return { message: 'Đã đăng xuất' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return { user };
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearTokenCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', { path: '/', secure: isProd, sameSite: 'lax' });
    res.clearCookie('refresh_token', { path: '/', secure: isProd, sameSite: 'lax' });
  }

  private extractToken(req: Request): string | null {
    if (req.cookies && req.cookies['access_token']) {
      return req.cookies['access_token'];
    }
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }

  private decodeToken(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  }
}
