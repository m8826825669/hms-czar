// frontend/src/lib/api/client.ts
//
// DEPRECATED. Kept only as a backward-compatibility shim.
//
// All API files now use the axios `api` instance from "@/lib/api" directly.
// That instance has request-side JWT attachment and a refresh-on-401 retry
// interceptor — neither of which the old hand-rolled fetch wrapper had.
//
// `apiClient` here is re-exported from `api` so any straggling imports keep
// working, but new code should import { api } from "@/lib/api" instead.

import { api } from "@/lib/api";

export const apiClient = api;
export default api;
