export const cssVar = (name: string, fallback?: string): string =>
	fallback ? `var(--${name}, ${fallback})` : `var(--${name})`;
