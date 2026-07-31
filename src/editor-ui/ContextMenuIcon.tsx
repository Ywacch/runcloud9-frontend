import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { CreateMenuItem } from '../lib/canvasContextMenuCatalog'
import { NODE_VISUAL } from '../lib/nodeVisual'
import { logoDataUrl } from '../svg-canvas/skins/logos'
import appServerUrl from '../assets/components/app-server.svg'
import loadBalancerUrl from '../assets/components/load-balancer.svg'
import workerUrl from '../assets/components/worker.svg'
import messageQueueUrl from '../assets/components/message-queue.svg'

const MENU_ITEM_LOGO_ID: Record<string, string> = {
  'database-postgresql': 'postgresql',
  'cache-redis': 'redis',
  'mq-rabbitmq': 'rabbitmq',
}

const GROUP_LOGO_ID: Record<string, string> = {
  database: 'postgresql',
  cache: 'redis',
  message_queue: 'rabbitmq',
}

const NODE_TYPE_ASSET: Partial<Record<CanvasNode['type'], string>> = {
  load_balancer: loadBalancerUrl,
  compute: appServerUrl,
  worker: workerUrl,
  message_queue: messageQueueUrl,
}

function iconForMenuItem(item: CreateMenuItem): {
  src: string
  alt: string
} {
  if (item.kind === 'place') {
    const logoId = MENU_ITEM_LOGO_ID[item.id]
    if (logoId) {
      const dataUrl = logoDataUrl(logoId)
      if (dataUrl) return { src: dataUrl, alt: item.label }
    }
    const asset = NODE_TYPE_ASSET[item.nodeType]
    if (asset) return { src: asset, alt: item.label }
    const face = NODE_VISUAL[item.nodeType]?.face ?? '#888'
    return {
      src: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="${face}"/></svg>`,
      )}`,
      alt: item.label,
    }
  }

  const logoId = GROUP_LOGO_ID[item.id]
  if (logoId) {
    const dataUrl = logoDataUrl(logoId)
    if (dataUrl) return { src: dataUrl, alt: item.label }
  }
  const child = item.children[0]
  if (child) return iconForMenuItem(child)
  return {
    src: `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#666"/></svg>',
    )}`,
    alt: item.label,
  }
}

export function ContextMenuIcon({
  item,
  locked,
}: {
  item: CreateMenuItem
  locked?: boolean
}) {
  const { src, alt } = iconForMenuItem(item)
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <img
        src={src}
        alt=""
        aria-hidden
        className={`h-4 w-4 object-contain ${locked ? 'opacity-40 grayscale' : ''}`}
        title={alt}
      />
      {locked ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 text-[8px] leading-none text-amber-300"
          aria-hidden
        >
          🔒
        </span>
      ) : null}
    </span>
  )
}
