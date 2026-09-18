import { treaty } from '@elysiajs/eden';
import type { App } from './app';
import { getApiConfig } from './config';

export const api = treaty<App>(`http://localhost:${getApiConfig().port}`);
