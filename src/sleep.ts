export function sleep(ms: number) {
	const startTime = performance.now()
	while (performance.now() - startTime < ms) {
		// Do nothing
	}
}
