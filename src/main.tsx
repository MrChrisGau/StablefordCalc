import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { CoursesProvider } from './lib/CoursesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <CoursesProvider>
        <App />
      </CoursesProvider>
    </I18nProvider>
  </StrictMode>,
)
