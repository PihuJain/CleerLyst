import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  actorUserId: string | null;
  route: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export type { RequestContext };
