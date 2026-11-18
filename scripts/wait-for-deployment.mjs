import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export function evaluateDeployment(response, deploymentId, previouslyObserved = false) {
  if (response.failures?.length) {
    return { state: 'failed', message: response.failures.map(f => f.reason).join(', ') };
  }
  const service = response.services?.[0];
  if (!service || service.status !== 'ACTIVE') {
    return { state: 'failed', message: 'El servicio ECS no esta activo.' };
  }
  const deployment = service.deployments.find(d => d.id === deploymentId);
  if (!deployment) {
    return {
      state: previouslyObserved ? 'failed' : 'pending',
      message: previouslyObserved ? 'El despliegue desaparecio; revisa un posible rollback.' : 'Esperando a que ECS muestre el nuevo despliegue.'
    };
  }
  if (deployment.rolloutState === 'FAILED' || deployment.status !== 'PRIMARY') {
    return { state: 'failed', observed: true, message: deployment.rolloutStateReason || 'El despliegue fallo o fue sustituido.' };
  }
  const stable = service.deployments.length === 1 &&
    service.runningCount === service.desiredCount && service.pendingCount === 0;
  if (deployment.rolloutState === 'COMPLETED' && stable) {
    return { state: 'completed', observed: true, message: `Despliegue ${deploymentId} COMPLETED; ${service.runningCount} tareas activas.` };
  }
  return {
    state: 'pending', observed: true,
    message: `${deploymentId}: ${deployment.rolloutState || 'PENDING'}, running=${service.runningCount}/${service.desiredCount}, pending=${service.pendingCount}`
  };
}

async function main() {
  const { ECS_CLUSTER, ECS_SERVICE, AWS_REGION, DEPLOYMENT_ID } = process.env;
  if (![ECS_CLUSTER, ECS_SERVICE, AWS_REGION, DEPLOYMENT_ID].every(value => value && value !== 'None')) {
    throw new Error('Faltan ECS_CLUSTER, ECS_SERVICE, AWS_REGION o DEPLOYMENT_ID.');
  }
  const timeoutSeconds = Number(process.env.DEPLOYMENT_TIMEOUT_SECONDS || 1200);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('DEPLOYMENT_TIMEOUT_SECONDS debe ser positivo.');
  }
  const deadline = Date.now() + timeoutSeconds * 1000;
  let observed = false;
  while (true) {
    const response = JSON.parse(execFileSync('aws', [
      'ecs', 'describe-services', '--cluster', ECS_CLUSTER, '--services', ECS_SERVICE,
      '--region', AWS_REGION, '--output', 'json', '--no-cli-pager',
      '--cli-connect-timeout', '10', '--cli-read-timeout', '20'
    ], { encoding: 'utf8', timeout: 35000 }));
    const result = evaluateDeployment(response, DEPLOYMENT_ID, observed);
    observed ||= result.observed === true;
    console.log(result.message);
    if (result.state === 'completed') return;
    if (result.state === 'failed') throw new Error(result.message);
    if (Date.now() >= deadline) throw new Error(`El despliegue no termino en ${timeoutSeconds} segundos.`);
    await setTimeout(15000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`::error::${error.message.replace(/[\r\n]+/g, ' ')}`);
    process.exitCode = 1;
  });
}
