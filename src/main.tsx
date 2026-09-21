import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import invariant from 'tiny-invariant'

import App from './App.tsx'

import './index.css'

const root = document.getElementById('root')!

invariant(root)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
