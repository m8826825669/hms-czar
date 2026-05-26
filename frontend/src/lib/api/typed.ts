/**
 * Type helpers for the auto-generated schema.
 *
 * Usage:
 *
 *   import type { ApiPaths, ApiResponse, ApiRequestBody } from "@/lib/api/typed";
 *
 *   // Response shape of `GET /api/v1/blood-bank/donors/{id}/`:
 *   type Donor = ApiResponse<"/api/v1/blood-bank/donors/{id}/", "get">;
 *
 *   // Request body of `POST /api/v1/blood-bank/donors/`:
 *   type DonorCreate = ApiRequestBody<"/api/v1/blood-bank/donors/", "post">;
 *
 * Once schema.ts is generated (npm run gen:api), the existing hand-written
 * lib/api/*.ts modules can opt into these types for end-to-end safety.
 *
 *   list: (params?: ...) =>
 *     api.get<ApiResponse<"/api/v1/blood-bank/donors/", "get">>(
 *       `${ROOT}/donors/`, { params },
 *     ).then(r => r.data),
 *
 * If a backend URL or response field changes and you re-run gen:api, tsc will
 * flag every consumer that's now broken. That's the whole point.
 */
import type { paths } from "@/lib/api/schema";

export type ApiPaths = paths;

// All HTTP methods that drf-spectacular emits.
type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * Successful response body type for `<path> <method>`. Picks 200 if present,
 * otherwise 201, otherwise falls back to `unknown`.
 */
export type ApiResponse<
  P extends keyof paths,
  M extends keyof paths[P] & HttpMethod,
> = paths[P][M] extends {
  responses: {
    200: { content: { "application/json": infer R } };
  };
}
  ? R
  : paths[P][M] extends {
        responses: {
          201: { content: { "application/json": infer R } };
        };
      }
    ? R
    : unknown;

/**
 * Request body type for `<path> <method>`. Returns `never` if the endpoint
 * doesn't accept a body.
 */
export type ApiRequestBody<
  P extends keyof paths,
  M extends keyof paths[P] & HttpMethod,
> = paths[P][M] extends {
  requestBody: { content: { "application/json": infer B } };
}
  ? B
  : never;

/**
 * Path parameter types for `<path> <method>`. Returns `never` if there are none.
 */
export type ApiPathParams<
  P extends keyof paths,
  M extends keyof paths[P] & HttpMethod,
> = paths[P][M] extends { parameters: { path: infer Q } } ? Q : never;

/**
 * Query parameter types for `<path> <method>`. Returns `never` if there are none.
 */
export type ApiQueryParams<
  P extends keyof paths,
  M extends keyof paths[P] & HttpMethod,
> = paths[P][M] extends { parameters: { query?: infer Q } } ? Q : never;
