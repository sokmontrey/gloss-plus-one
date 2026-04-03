import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const mount = document.createElement('div')
mount.id = 'gloss-plus-one-root'
mount.setAttribute('data-gloss-plus-one', '')
Object.assign(mount.style, {
  all: 'initial',
  position: 'fixed',
  right: '12px',
  bottom: '12px',
  zIndex: '2147483647',
  fontFamily: 'system-ui, sans-serif',
})
document.documentElement.append(mount)

createRoot(mount).render(
  <StrictMode>
    <App variant="content" />
  </StrictMode>,
)
