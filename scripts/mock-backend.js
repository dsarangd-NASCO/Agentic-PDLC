const http = require('http');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.MOCK_BACKEND_PORT || 3001);

const now = () => new Date().toISOString();

const deployments = [
  {
    deployment_id: 'dep-001',
    service_id: 'deploy-hub-api',
    target_env: 'dev',
    status: 'complete',
    artifact_url: 'ecr://deploy-hub/api:abc123-dev',
    progress: 100,
    current_stage: 'finalize',
    created_at: now(),
    updated_at: now(),
    completed_at: now(),
    error_message: null,
    previous_deployment_id: null,
  },
  {
    deployment_id: 'dep-002',
    service_id: 'billing-api',
    target_env: 'stage',
    status: 'verifying',
    artifact_url: 'ecr://billing/api:def456-stage',
    progress: 80,
    current_stage: 'verify',
    created_at: now(),
    updated_at: now(),
    completed_at: null,
    error_message: null,
    previous_deployment_id: null,
  },
];

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function sendNotFound(res) {
  sendJson(res, 404, {
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    timestamp: now(),
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'healthy',
      checks: {
        database: 'ok',
        codebuild: 'ok',
        codedeploy: 'ok',
      },
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: now(),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health/ready') {
    sendJson(res, 200, { status: 'ready' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/deployments') {
    sendJson(res, 200, deployments);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/deployments') {
    try {
      const body = await parseBody(req);
      const record = {
        deployment_id: randomUUID(),
        service_id: body.service_id || 'unknown-service',
        target_env: body.target_env || 'dev',
        status: 'queued',
        artifact_url: body.artifact_url || '',
        progress: 0,
        current_stage: null,
        created_at: now(),
        updated_at: now(),
        completed_at: null,
        error_message: null,
        previous_deployment_id: null,
      };
      deployments.unshift(record);
      sendJson(res, 201, record);
    } catch (err) {
      sendJson(res, 400, {
        error: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
        timestamp: now(),
      });
    }
    return;
  }

  const deploymentMatch = url.pathname.match(/^\/deployments\/([^/]+)$/);
  if (req.method === 'GET' && deploymentMatch) {
    const deployment = deployments.find((d) => d.deployment_id === deploymentMatch[1]);
    if (!deployment) {
      sendJson(res, 404, {
        error: 'DEPLOYMENT_NOT_FOUND',
        message: 'Deployment not found',
        timestamp: now(),
      });
      return;
    }
    sendJson(res, 200, deployment);
    return;
  }

  const stagesMatch = url.pathname.match(/^\/deployments\/([^/]+)\/stages$/);
  if (req.method === 'GET' && stagesMatch) {
    sendJson(res, 200, {
      deployment_id: stagesMatch[1],
      stages: [
        {
          stage_name: 'prepare',
          status: 'complete',
          started_at: now(),
          completed_at: now(),
          duration_ms: 12000,
          error_message: null,
        },
        {
          stage_name: 'validate',
          status: 'complete',
          started_at: now(),
          completed_at: now(),
          duration_ms: 8000,
          error_message: null,
        },
        {
          stage_name: 'deploy',
          status: 'running',
          started_at: now(),
          completed_at: null,
          duration_ms: null,
          error_message: null,
        },
      ],
    });
    return;
  }

  const logsMatch = url.pathname.match(/^\/deployments\/([^/]+)\/logs$/);
  if (req.method === 'GET' && logsMatch) {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      `[${now()}] deployment=${logsMatch[1]} stage=prepare status=complete\n` +
        `[${now()}] deployment=${logsMatch[1]} stage=validate status=complete\n` +
        `[${now()}] deployment=${logsMatch[1]} stage=deploy status=running\n`
    );
    return;
  }

  const rollbackMatch = url.pathname.match(/^\/deployments\/([^/]+)\/rollback$/);
  if (req.method === 'POST' && rollbackMatch) {
    sendJson(res, 200, {
      rollback_id: randomUUID(),
      deployment_id: rollbackMatch[1],
      previous_deployment_id: 'dep-previous',
      status: 'initiated',
      created_at: now(),
    });
    return;
  }

  sendNotFound(res);
});

server.listen(PORT, () => {
  console.log(`Mock backend running on http://localhost:${PORT}`);
  console.log('Endpoints: /health, /health/ready, /deployments');
});
