import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`❌ Missing required env var: ${name}`);
  return val;
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    requireEnv('JWT_ACCESS_SECRET');
    requireEnv('JWT_REFRESH_SECRET');
    requireEnv('CORS_ORIGIN');
  }
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser());
  app.use(helmet());

  // Set trust proxy for production
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const allowedOrigins = new Set(
    (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim().toLowerCase())
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin.toLowerCase())) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

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

