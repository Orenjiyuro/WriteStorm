import type { MessageEvent as ElectronMessageEvent } from 'electron';
import {
  STRUCTURE_WORKER_PROTOCOL_VERSION,
  isUtilityWorkerRequest,
} from './structure-worker-protocol';
import { measureStructureWorkerDetection } from './structure-worker-performance';

const parentPort = process.parentPort;

if (!parentPort) {
  throw new Error('Structure utility worker requires an Electron parent port.');
}

parentPort.on('message', (event: ElectronMessageEvent) => {
  const request = event.data;

  if (!isUtilityWorkerRequest(request)) {
    process.exit(18);
    return;
  }

  switch (request.command) {
    case 'echo':
      parentPort.postMessage({
        version: STRUCTURE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        command: 'echo',
        ok: true,
        workerPid: process.pid,
        payload: request.payload ?? '',
      });
      return;
    case 'detect':
      {
        const measured = measureStructureWorkerDetection(request.input);
      parentPort.postMessage({
        version: STRUCTURE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        command: 'detect',
        ok: true,
        workerPid: process.pid,
        result: measured.result,
        telemetry: measured.telemetry,
      });
      return;
      }
    case 'hang':
      return;
    case 'crash':
      process.exit(19);
  }
});
