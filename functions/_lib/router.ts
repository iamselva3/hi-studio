import type { Env } from './types';
import { badRequest } from './http';

export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  ip: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

export type Match = { handler: Handler; params: Record<string, string> } | { methodNotAllowed: true } | null;

/**
 * Minimal router. Patterns: literal segments, `:name` (one segment) and `*name` (rest of the path, last only).
 */
export class Router {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: Handler): this {
    const keys: string[] = [];
    const source = pattern
      .split('/')
      .map((segment) => {
        if (segment.startsWith(':')) {
          keys.push(segment.slice(1));
          return '([^/]+)';
        }
        if (segment.startsWith('*')) {
          keys.push(segment.slice(1));
          return '(.+)';
        }
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler });
    return this;
  }

  get = (pattern: string, handler: Handler) => this.on('GET', pattern, handler);
  post = (pattern: string, handler: Handler) => this.on('POST', pattern, handler);
  patch = (pattern: string, handler: Handler) => this.on('PATCH', pattern, handler);
  delete = (pattern: string, handler: Handler) => this.on('DELETE', pattern, handler);

  match(method: string, path: string): Match {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        try {
          params[key] = decodeURIComponent(m[i + 1]);
        } catch {
          throw badRequest('Malformed URL');
        }
      });
      return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}
