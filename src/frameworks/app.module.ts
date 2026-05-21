import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeploymentController } from '@adapters/controllers/DeploymentController';
import { HealthController } from '@adapters/controllers/HealthController';

/**
 * DeployHub NestJS Application Module
 * Dependency injection container and routing setup
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
    }),
  ],
  controllers: [DeploymentController, HealthController],
  providers: [],
})
export class AppModule {}
