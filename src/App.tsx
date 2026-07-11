import { useState } from 'react'
import CoursesPage from './pages/CoursesPage'
import PlayersPage from './pages/PlayersPage'
import RoundPage from './pages/RoundPage'
import DataPage from './pages/DataPage'
import { useTranslation } from './i18n'

type Tab = 'play' | 'courses' | 'players' | 'data'

function App() {
  const [tab, setTab] = useState<Tab>('play')
  const { t } = useTranslation()

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
      </header>

      <main className="app-main">
        {tab === 'play' && <RoundPage />}
        {tab === 'courses' && <CoursesPage />}
        {tab === 'players' && <PlayersPage />}
        {tab === 'data' && <DataPage />}
      </main>

      <nav className="tabbar">
        <button className={tab === 'play' ? 'active' : ''} onClick={() => setTab('play')}>
          {t('nav.play')}
        </button>
        <button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>
          {t('nav.courses')}
        </button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          {t('nav.players')}
        </button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
          {t('nav.data')}
        </button>
      </nav>
    </div>
  )
}

export default App
