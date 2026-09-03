export function requestIdFrom(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function logError(
  error: unknown,
  context: Record<string, unknown>,
): void {
  console.error(
    JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      ...context,
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
}
