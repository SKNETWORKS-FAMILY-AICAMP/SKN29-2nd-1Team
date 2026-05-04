import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import Navbar from './components/Navbar'
import AnimatedPage from './components/layout/AnimatedPage'
import LandingPage from './pages/LandingPage'
import TrendingPage from './pages/TrendingPage'
import VideoPage from './pages/VideoPage'
import SustainPage from './pages/SustainPage'
import DashboardPage from './pages/DashboardPage'
import CampaignPlannerPage from './pages/CampaignPlannerPage'
import ApiStatusBanner from './components/ApiStatusBanner'
import { useDarkMode } from './hooks/useDarkMode'
import { useApiHealth } from './hooks/useApiHealth'

import './App.css'
import './styles/ChartRenderFix.css'

const ROUTES = [
  { path: '/', key: 'home', Component: LandingPage },
  { path: '/analysis/*', key: 'analysis', Component: TrendingPage },
  { path: '/video', key: 'video', Component: VideoPage },
  { path: '/sustain', key: 'sustain', Component: SustainPage },
  { path: '/campaign', key: 'campaign', Component: CampaignPlannerPage },
  { path: '/dashboard', key: 'dashboard', Component: DashboardPage },
]

export default function App() {
  const [darkMode, setDarkMode] = useDarkMode()
  const apiOnline = useApiHealth()

  return (
    <BrowserRouter>
      <div className={`yta-root ${darkMode ? 'dark' : ''}`}>
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        {!apiOnline && <ApiStatusBanner />}

        <AnimatePresence mode="wait">
          <Routes>
            {ROUTES.map(({ path, key, Component }) => (
              <Route
                key={key}
                path={path}
                element={(
                  <AnimatedPage pageKey={key}>
                    <Component />
                  </AnimatedPage>
                )}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    </BrowserRouter>
  )
}
