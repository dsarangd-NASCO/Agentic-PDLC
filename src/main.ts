import { NestFactory } from '@nestjs/core';
import { AppModule } from '@frameworks/app.module';
import { loadEnvironment } from '@config/environment';
import { Logger } from '@common/logging/Logger';

const logger = new Logger('DeployHub');

async function bootstrap(): Promise<void> {
  const config = loadEnvironment();

  logger.info('Starting Deploy-Hub', {
    environment: config.NODE_ENV,
    port: config.PORT,
  });

  const app = await NestFactory.create(AppModule);

  // Enable CORS for local development
  if (config.NODE_ENV === 'development') {
    app.enableCors();
  }

  await app.listen(config.PORT);

  logger.info('Deploy-Hub started successfully', {
    port: config.PORT,
    environment: config.NODE_ENV,
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Deploy-Hub', error);
  process.exit(1);
});
