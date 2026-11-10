import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

document.documentElement.dataset.platform = window.api.platform

const container = document.getElementById('root')
if (!container) {
  throw new Error('No se encontró el contenedor de la aplicación.')
}

createRoot(container).render(<App />)
