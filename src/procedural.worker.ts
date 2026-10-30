// Generates the scene's procedural textures off the main thread (see procedural.ts).
import { generateProcedural, transferables } from './procedural';
import type { ProceduralParams } from './procedural';

const scope = self as unknown as { onmessage: ((event: MessageEvent<ProceduralParams>) => void) | null; postMessage(message: unknown, transfer: Transferable[]): void };
scope.onmessage = (event) => {
  const maps = generateProcedural(event.data);
  scope.postMessage(maps, transferables(maps));
};
