/** Fallback when /meta/jobs is unavailable; mirrors ganymede/pkg/engines/data/jobs.yaml. */
export const JOB_COMPONENTS: Record<string, string> = {
  main_db: 'db',
  hot_cache: 'cache',
  timeline: 'cache',
  work_queue: 'mq',
}