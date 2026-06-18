import { BUFFER_MAX_SAMPLES } from './playbackConfig'
import type { BufferedSample } from './wsMetricsTypes'

export interface PlayheadBracket {
  before: BufferedSample
  after: BufferedSample
  /** Interpolation ratio 0→1 between before and after server timestamps. */
  t: number
}

export class MetricsBuffer {
  private samples: BufferedSample[] = []

  get length(): number {
    return this.samples.length
  }

  getSamples(): readonly BufferedSample[] {
    return this.samples
  }

  add(sample: BufferedSample): void {
    const last = this.samples[this.samples.length - 1]
    if (last && last.serverTimestamp === sample.serverTimestamp) {
      this.samples[this.samples.length - 1] = sample
      return
    }
    this.samples = [...this.samples, sample].slice(-BUFFER_MAX_SAMPLES)
  }

  clear(): void {
    this.samples = []
  }

  /** Samples strictly after playhead (for freeze / underrun detection). */
  samplesAheadOf(playheadMs: number): BufferedSample[] {
    return this.samples.filter((s) => s.serverTimestamp > playheadMs)
  }

  isFrozen(playheadMs: number): boolean {
    return this.samplesAheadOf(playheadMs).length < 2
  }

  /**
   * Bracketing samples for playhead interpolation.
   * Returns null when fewer than two samples exist or playhead is before the first sample.
   */
  samplesAroundPlayhead(playheadMs: number): PlayheadBracket | null {
    if (this.samples.length < 2) return null

    let before: BufferedSample | null = null
    let after: BufferedSample | null = null

    for (const sample of this.samples) {
      if (sample.serverTimestamp <= playheadMs) {
        before = sample
      } else if (!after) {
        after = sample
        break
      }
    }

    if (!before || !after) return null

    const span = after.serverTimestamp - before.serverTimestamp
    const t = span > 0 ? (playheadMs - before.serverTimestamp) / span : 0
    return { before, after, t: Math.max(0, Math.min(1, t)) }
  }
}
