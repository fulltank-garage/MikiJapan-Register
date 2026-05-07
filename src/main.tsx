import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getLineIdentity, isLiffLoginRedirectError } from './lib/liff'

const root = createRoot(document.getElementById('root')!)

const renderApp = () => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const bootstrap = async () => {
  try {
    await getLineIdentity()
  } catch (error) {
    if (isLiffLoginRedirectError(error)) {
      return
    }

    console.error(error)
  }

  renderApp()
}

void bootstrap()
