import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import contentStylesUrl from './index.css?url'

function extensionStylesheetHref(url: string): string {
  if (url.startsWith('chrome-extension://')) return url
  const path = url.startsWith('/') ? url.slice(1) : url
  return chrome.runtime.getURL(path)
}

const mount = document.createElement('div')
mount.id = 'gloss-plus-one-root'
mount.setAttribute('data-gloss-plus-one', '')
Object.assign(mount.style, {
  all: 'initial',
  position: 'fixed',
  right: '12px',
  bottom: '12px',
  zIndex: '2147483647',
})
document.documentElement.append(mount)

const shadow = mount.attachShadow({ mode: 'open' })
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = extensionStylesheetHref(contentStylesUrl)
shadow.append(link)

const rootEl = document.createElement('div')
shadow.append(rootEl)

createRoot(rootEl).render(
  <StrictMode>
    <App variant="content" />
  </StrictMode>,
)
