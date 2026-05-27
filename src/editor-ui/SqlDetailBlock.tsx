import { formatSqlForDisplay } from '../lib/formatSqlDetail'

export function SqlDetailBlock({ sql }: { sql: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-black/35 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
      {formatSqlForDisplay(sql)}
    </pre>
  )
}
