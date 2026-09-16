// Preloaded before setup.ts to populate process.env from .env.test
// so that config.ts and all other modules see test values at import time.
// On CI the env vars are already set via the workflow, so the file may not exist.
const envFile = Bun.file(`${import.meta.dir}/../.env.test`);
if (await envFile.exists()) {
	const envContent = await envFile.text();
	for (const line of envContent.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx);
		const value = trimmed.slice(eqIdx + 1);
		process.env[key] = value;
	}
}

export {};
