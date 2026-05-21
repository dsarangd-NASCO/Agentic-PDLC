/**
 * Environment configuration
 * Loads from .env file
 */

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  AWS_REGION: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

export function loadEnvironment(): EnvironmentConfig {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/deploy_hub',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  };
}
