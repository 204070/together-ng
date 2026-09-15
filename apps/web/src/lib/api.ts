import { treaty } from '@elysiajs/eden';
import type { App } from '@together/api';

// Eden Treaty client over the API's Elysia App type. The `App` import is
// type-only (erased at runtime by `import type`), so this module never loads
// `@together/api` as a value and triggers none of its side-effects
// (loadEnv/createAuthServices). Every API call in this app goes through this
// client — never fetch with hand-typed JSON.
export function createApiClient(baseUrl: string) {
	return treaty<App>(baseUrl);
}

export type ApiClient = ReturnType<typeof createApiClient>;
