import { fmtErrorRate, fmtInt, fmtPct } from './format'
import type { CrashContext } from '../editor-core/domain/metricsUiContract'

/** Human-readable correlate lines for pod restart/OOM timeline cards. */
export function crashContextLines(ctx: CrashContext): string[] {
  const lines: string[] = []
  if (ctx.memPercent != null && ctx.memPercent > 0) {
    lines.push(`Memory ${fmtPct(ctx.memPercent)}`)
  }
  if (ctx.cpuPercent != null && ctx.cpuPercent > 0) {
    lines.push(`CPU ${fmtPct(ctx.cpuPercent)}`)
  }
  if (ctx.activeConnections != null && ctx.activeConnections > 0) {
    lines.push(`Connections ${fmtInt(ctx.activeConnections)}`)
  }
  if (ctx.redisRejectedRate != null && ctx.redisRejectedRate > 0) {
    lines.push(`Redis rejected/s ${fmtInt(ctx.redisRejectedRate)}`)
  }
  if (ctx.redisOpsPerSec != null && ctx.redisOpsPerSec > 0) {
    lines.push(`Redis ops/s ${fmtInt(ctx.redisOpsPerSec)}`)
  }
  if (ctx.errorRate != null && ctx.errorRate > 0) {
    lines.push(`Error rate ${fmtErrorRate(ctx.errorRate)}`)
  }
  if (ctx.queueDepth != null && ctx.queueDepth > 0) {
    lines.push(`Queue depth ${fmtInt(ctx.queueDepth)}`)
  }
  if (ctx.terminationReason) {
    lines.push(`Termination ${ctx.terminationReason}`)
  }
  if (ctx.waitingReason) {
    lines.push(`Waiting ${ctx.waitingReason}`)
  }
  if (ctx.exitCode != null && ctx.exitCode !== 0) {
    lines.push(`Exit code ${ctx.exitCode}`)
  }
  return lines
}
