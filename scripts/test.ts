import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

interface PackageInfo {
	name: string;
	dir: string;
}

const REPO_ROOT = resolve(import.meta.dir, '..');

function workspaceDirs(): string[] {
	const rootPackage = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
		workspaces?: string[];
	};
	const dirs: string[] = [];
	for (const pattern of rootPackage.workspaces ?? []) {
		const basePath = resolve(REPO_ROOT, pattern.replace(/\/\*$/, ''));
		const entry = statSync(basePath, { throwIfNoEntry: false });
		if (!entry?.isDirectory()) continue;
		for (const child of readdirSync(basePath, { withFileTypes: true })) {
			if (child.isDirectory()) dirs.push(resolve(basePath, child.name));
		}
	}
	return dirs;
}

function packagesWithTests(): PackageInfo[] {
	const packages: PackageInfo[] = [];
	for (const dir of workspaceDirs()) {
		const manifestPath = resolve(dir, 'package.json');
		if (!statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
			name?: string;
			scripts?: Record<string, string>;
		};
		if (!manifest.name || typeof manifest.scripts?.test !== 'string') continue;
		packages.push({ name: manifest.name, dir });
	}
	packages.sort((a, b) => a.name.localeCompare(b.name));
	return packages;
}

const packages = packagesWithTests();
if (packages.length === 0) {
	console.error('test: no workspace package defines a test script');
	process.exit(1);
}

const failed: string[] = [];
for (const pkg of packages) {
	console.log(`\ntest: ${pkg.name} (${pkg.dir})`);
	const result = spawnSync(process.execPath, ['run', '--filter', pkg.name, 'test'], {
		cwd: REPO_ROOT,
		env: process.env,
		stdio: 'inherit',
	});
	if (result.status !== 0 || result.signal) {
		failed.push(pkg.name);
	}
}

if (failed.length > 0) {
	console.error(
		`\ntest: ${failed.length} of ${packages.length} package suite(s) failed: ${failed.join(', ')}`,
	);
	process.exit(1);
}
console.log(`\ntest: all ${packages.length} package suite(s) passed`);
process.exit(0);
