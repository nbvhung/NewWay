import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser());

  // Set trust proxy for production
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Allow all vercel.app, onrender.com and localhost origins
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        'http://localhost:3000',
        'http://localhost:4000',
        '.vercel.app',
        '.onrender.com',
        ...(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
      ];
      if (allowed.some(o => origin === o || origin.endsWith(o))) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all in production for simplicity
      }
    },
    credentials: true,
  });

  // Health check endpoint for Render (must be before NestJS validation pipe)
  expressApp.get('/api/health', (_req: any, res: any) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n🚀 Backend running on http://localhost:${port}`);
}

bootstrap();

