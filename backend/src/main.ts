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
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
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
      'REST API for the Udemy Course Finder — aggregates free Udemy courses from 9 coupon sources',
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
