import { useState } from 'react'
import CoursesPage from './pages/CoursesPage'
import PlayersPage from './pages/PlayersPage'
import RoundPage from './pages/RoundPage'
import DataPage from './pages/DataPage'

type Tab = 'play' | 'courses' | 'players' | 'data'

function App() {
  const [tab, setTab] = useState<Tab>('play')

  return (
    <div className="app">
      <header className="app-header">
        <h1>Stableford</h1>
      </header>

      <main className="app-main">
        {tab === 'play' && <RoundPage />}
        {tab === 'courses' && <CoursesPage />}
        {tab === 'players' && <PlayersPage />}
        {tab === 'data' && <DataPage />}
      </main>

      <nav className="tabbar">
        <button className={tab === 'play' ? 'active' : ''} onClick={() => setTab('play')}>
          Spielbetrieb
        </button>
        <button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>
          Plätze
        </button>
        <button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}>
          Spieler
        </button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>
          Daten
        </button>
      </nav>
    </div>
  )
}

export default App
