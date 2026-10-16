import { assertSameOrigin, errorResponse } from "./http";

export type IdContext = { params: Promise<{ id: string }> };

/** Wraps a route handler with the CSRF origin check and uniform error mapping. */
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
