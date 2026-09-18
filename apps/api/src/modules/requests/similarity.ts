const FUNDAMENTAL_FIELDS = ['goal', 'barrier', 'helpNeeded'] as const;

export function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	let prev = Array.from({ length: n + 1 }, (_, i) => i);
	let curr = new Array<number>(n + 1).fill(0);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const del = (prev[j] ?? 0) + 1;
			const ins = (curr[j - 1] ?? 0) + 1;
			const sub = (prev[j - 1] ?? 0) + cost;
			curr[j] = Math.min(del, ins, sub);
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}
	return prev[n] ?? 0;
}

export function computeChangeRatio(
	old: Record<string, unknown>,
	patch: Record<string, unknown>,
): number {
	let totalChars = 0;
	let changedChars = 0;
	for (const field of FUNDAMENTAL_FIELDS) {
		const oldVal = String(old[field] ?? '');
		const newVal = patch[field] !== undefined ? String(patch[field]) : oldVal;
		totalChars += oldVal.length;
		changedChars += Math.abs(newVal.length - oldVal.length);
		if (oldVal !== newVal) {
			changedChars += levenshteinDistance(oldVal, newVal);
		}
	}
	if (totalChars === 0) return 1;
	const similarity = 1 - changedChars / (2 * totalChars);
	return 1 - similarity;
}
