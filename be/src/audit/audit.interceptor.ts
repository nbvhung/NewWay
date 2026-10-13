import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from './audit.service';

/** Request tự động / nhiễu — không ghi audit. */
const EXCLUDE = [
  '/auth/refresh',
  '/auth/mobile-refresh',
  '/auth/me',
  '/zalo/webhook',
  '/zalo/poll',
  '/submissions/my/live',
];

/** Không bao giờ ghi nội dung các field này. */
const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'refreshToken',
  'accessToken',
  'token',
  'cookie',
  'x-cost-password',
  'authorization',
];

function sanitize(body: any): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body !== 'object') return String(body).slice(0, 2000);
  const scrub = (val: any): any => {
    if (Array.isArray(val)) return val.slice(0, 50).map(scrub);
    if (val && typeof val === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
          out[k] = '***';
        } else {
          out[k] = scrub(v);
        }
      }
      return out;
    }
    return val;
  };
  try {
    const json = JSON.stringify(scrub(body));
    return json && json.length > 2000 ? json.slice(0, 2000) + '…' : json;
  } catch {
    return null;
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const method = String(req.method || '').toUpperCase();
    const path = String(req.originalUrl || req.url || '').split('?')[0];

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isExport = method === 'GET' && /export|ket-thuc/i.test(path);
    if (!isMutation && !isExport) return next.handle();
    if (EXCLUDE.some((p) => path.includes(p))) return next.handle();

    const write = (status: number) => {
      const u = req.user || {};
      const fwd = String(req.headers?.['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();
      this.audit.safeLog({
        userId: u.id ?? u.sub ?? null,
        username:
          u.username || (req.body && req.body.username) || '',
        fullName: u.fullName || '',
        role: u.role || '',
        method,
        path,
        action: this.audit.label(method, path),
        status,
        ip: fwd || req.headers?.['x-real-ip'] || req.ip || '',
        userAgent: String(req.headers?.['user-agent'] || '').slice(0, 500),
        body: sanitize(req.body),
      });
    };

    return next.handle().pipe(
      tap({
        next: () => write(res.statusCode || 200),
        error: (err) => write(err?.status || err?.statusCode || 500),
      }),
      catchError((err) => throwError(() => err)),
    );
  }
}
