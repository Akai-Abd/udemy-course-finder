import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  // ───────────── Security ─────────────
  app.use(helmet());

  // ───────────── CORS ─────────────
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl) or any localhost/127.0.0.1 origin
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        const allowed = process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
          : [];
        if (allowed.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      }
    },
    credentials: true,
  });

  // ───────────── Global Pipes ─────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ───────────── Global Filters ─────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ───────────── Swagger ─────────────
  const config = new DocumentBuilder()
    .setTitle('Udemy Course Finder API')
    .setDescription(
      'REST API for the Udemy Course Finder — aggregates free Udemy courses from 10 coupon sources',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ───────────── Start ─────────────
  const port = process.env.BACKEND_PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Backend API running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api`);
}

void bootstrap();
