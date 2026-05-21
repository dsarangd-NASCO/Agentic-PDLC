/**
 * Deployment error types
 * ZERO external dependencies
 */

export class DeploymentError extends Error {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export class DeploymentNotFoundError extends DeploymentError {
  constructor(deploymentId: string) {
    super(
      'DEPLOYMENT_NOT_FOUND',
      `Deployment ${deploymentId} not found`,
      404,
    );
  }
}

export class InvalidDeploymentRequest extends DeploymentError {
  constructor(message: string) {
    super('INVALID_REQUEST', message, 400);
  }
}

export class DeploymentStateTransitionError extends DeploymentError {
  constructor(from: string, to: string) {
    super(
      'INVALID_STATE_TRANSITION',
      `Cannot transition from ${from} to ${to}`,
      400,
    );
  }
}

export class RateLimitError extends DeploymentError {
  constructor() {
    super('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded: 100 requests/minute', 429);
  }
}

export class UnauthorizedError extends DeploymentError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends DeploymentError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class InternalServerError extends DeploymentError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_SERVER_ERROR', message, 500);
  }
}
