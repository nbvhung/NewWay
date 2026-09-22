import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi server nội bộ';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
      const rawMsg = Array.isArray(message) ? message.join(', ') : message;
      if (status >= 400 && status < 500) {
        const req = ctx.getRequest();
        console.error(`[${status}] ${req?.method} ${req?.url} →`, rawMsg);
      }
      if (Array.isArray(message)) message = message[0];
    } else if (exception instanceof Error) {
      console.error('Unhandled error:', exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: status >= 500 ? 'Internal Server Error' : undefined,
    });
  }
}
