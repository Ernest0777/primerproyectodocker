import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeployment } from '../scripts/wait-for-deployment.mjs';

const deploymentId = 'ecs-svc/123';
function response(rolloutState = 'IN_PROGRESS') {
  return {
    failures: [],
    services: [{
      status: 'ACTIVE', desiredCount: 2, runningCount: 2, pendingCount: 0,
      deployments: [{ id: deploymentId, status: 'PRIMARY', rolloutState }]
    }]
  };
}

test('dos tareas activas con IN_PROGRESS siguen esperando', () => {
  const current = response();
  assert.equal(evaluateDeployment(current, deploymentId).state, 'pending');
  current.services[0].deployments[0].rolloutState = 'COMPLETED';
  assert.equal(evaluateDeployment(current, deploymentId, true).state, 'completed');
});

test('FAILED se detecta incluso con dos tareas activas', () => {
  assert.equal(evaluateDeployment(response('FAILED'), deploymentId).state, 'failed');
});

test('un despliegue anterior COMPLETED no valida el nuevo', () => {
  assert.equal(evaluateDeployment(response('COMPLETED'), 'ecs-svc/456').state, 'pending');
});

test('desaparicion tras observar el despliegue detecta posible rollback', () => {
  assert.equal(evaluateDeployment(response('COMPLETED'), 'ecs-svc/456', true).state, 'failed');
});

test('un despliegue sustituido no se considera exitoso', () => {
  const current = response('COMPLETED');
  current.services[0].deployments[0].status = 'ACTIVE';
  assert.equal(evaluateDeployment(current, deploymentId).state, 'failed');
});

test('COMPLETED con tareas pendientes sigue esperando', () => {
  const current = response('COMPLETED');
  current.services[0].pendingCount = 1;
  assert.equal(evaluateDeployment(current, deploymentId).state, 'pending');
});

test('servicio no encontrado falla', () => {
  assert.equal(evaluateDeployment({ services: [], failures: [{ reason: 'MISSING' }] }, deploymentId).state, 'failed');
});
