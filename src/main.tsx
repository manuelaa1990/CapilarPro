import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { App } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el elemento root')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
