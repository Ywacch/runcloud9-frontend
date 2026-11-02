export function cacheLogEmptyMessage(engine: string | undefined): string {
  if (String(engine ?? '').trim().toLowerCase() === 'memcached') {
    return 'Memcached logs errors and warnings only.'
  }
  return 'NO EVENTS AT THIS LEVEL IN THE CURRENT WINDOW'
}
