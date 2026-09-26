import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DeletePasswordGuard } from './delete-password.guard';
import { ACTION_PASSWORD } from '../security/action-password';

/**
 * Mật khẩu xoá: mọi request DELETE đều phải kèm mật khẩu thao tác (348).
 * Các method khác không bị ảnh hưởng.
 */
function ctx(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const guard = new DeletePasswordGuard();

describe('DeletePasswordGuard — bắt buộc mật khẩu cho mọi DELETE', () => {
  it('GET/POST/PUT/PATCH đi thẳng, không cần mật khẩu', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(ctx({ method }))).toBe(true);
    }
  });

  it('method viết thường vẫn bị chặn (delete)', () => {
    expect(() => guard.canActivate(ctx({ method: 'delete' }))).toThrow(ForbiddenException);
  });

  it('DELETE không nhập mật khẩu => 403', () => {
    expect(() => guard.canActivate(ctx({ method: 'DELETE', headers: {}, query: {} }))).toThrow(
      ForbiddenException,
    );
  });

  it('DELETE sai mật khẩu => 403', () => {
    expect(() =>
      guard.canActivate(ctx({ method: 'DELETE', headers: { 'x-cost-password': '123' }, query: {} })),
    ).toThrow(ForbiddenException);
  });

  it('DELETE mật khẩu rỗng / toàn khoảng trắng => 403', () => {
    for (const value of ['', '   ']) {
      expect(() =>
        guard.canActivate(ctx({ method: 'DELETE', headers: { 'x-cost-password': value }, query: {} })),
      ).toThrow(ForbiddenException);
    }
  });

  it('DELETE đúng mật khẩu qua header => cho qua', () => {
    expect(
      guard.canActivate(
        ctx({ method: 'DELETE', headers: { 'x-cost-password': ACTION_PASSWORD }, query: {} }),
      ),
    ).toBe(true);
  });

  it('DELETE đúng mật khẩu qua query ?pw= => cho qua', () => {
    expect(
      guard.canActivate(ctx({ method: 'DELETE', headers: {}, query: { pw: ACTION_PASSWORD } })),
    ).toBe(true);
  });

  it('mật khẩu có khoảng trắng thừa vẫn chấp nhận (trim)', () => {
    expect(
      guard.canActivate(
        ctx({ method: 'DELETE', headers: { 'x-cost-password': `  ${ACTION_PASSWORD} ` }, query: {} }),
      ),
    ).toBe(true);
  });

  it('header nhiều giá trị (mảng) lấy giá trị đầu', () => {
    expect(
      guard.canActivate(
        ctx({ method: 'DELETE', headers: { 'x-cost-password': [ACTION_PASSWORD, 'x'] }, query: {} }),
      ),
    ).toBe(true);
  });

  it('req.query là getter bị throw (Express 5) vẫn không crash guard', () => {
    const req: any = { method: 'DELETE', headers: {} };
    Object.defineProperty(req, 'query', {
      get() {
        throw new Error('query parser chưa chạy');
      },
    });
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
  });

  it('query pw dạng mảng lấy giá trị đầu', () => {
    expect(
      guard.canActivate(ctx({ method: 'DELETE', headers: {}, query: { pw: [ACTION_PASSWORD, 'x'] } })),
    ).toBe(true);
  });

  it('guard được đăng ký TOÀN CỤC trong AppModule (không thể quên cho endpoint mới)', () => {
    const src = readFileSync(join(__dirname, '../../app.module.ts'), 'utf8');
    expect(src).toContain('DeletePasswordGuard');
    expect(src).toMatch(/provide:\s*APP_GUARD,\s*useClass:\s*DeletePasswordGuard/);
  });
});
