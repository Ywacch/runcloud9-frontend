import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  absoluteUrl,
  resolvePublicSeo,
  siteJsonLdGraph,
} from '../../lib/publicSeo'

const JSON_LD_SCRIPT_ID = 'rc9-jsonld'

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

function upsertJsonLd(): void {
  let el = document.getElementById(JSON_LD_SCRIPT_ID) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.id = JSON_LD_SCRIPT_ID
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(siteJsonLdGraph())
}

/** Keeps title / description / OG / canonical aligned with the active public route. */
export function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = resolvePublicSeo(pathname)
    const url = absoluteUrl(seo.path)

    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    upsertCanonical(url)
    upsertJsonLd()
  }, [pathname])

  return null
}
