import { AdminAuth, AdminGuard, Login } from './admin/Auth'
import Dashboard from './admin/Dashboard'
import Editor from './admin/Editor'
import CollectionUpdates from './components/CollectionUpdates'
import LanguageSelector from './components/LanguageSelector'
import { useLanguage } from './i18n/useLanguage'
import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowUpRight, Coins } from 'lucide-react'
import { isDemo } from './lib/supabase'
import Home from './pages/Home'
import Collection from './pages/Collection'
import Details from './pages/Details'
import About from './pages/About'
import NotFound from './pages/NotFound'
function Logo() {
  const { t } = useLanguage()

  return (
    <Link to="/" className="brand" aria-label={t('My Coin Collection home')}>
      <span className="brand-icon">
        <Coins size={26} strokeWidth={1.3} />
      </span>
      <span>
        {t('My Coin Collection')}
        <small>{t('A PERSONAL NUMISMATIC JOURNEY')}</small>
      </span>
    </Link>
  )
}
export default function App() {
  const { t } = useLanguage()

  const location = useLocation()
  useEffect(() => {
    document.getElementById('main')?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  return (
    <AdminAuth>
      <CollectionUpdates />
      <a className="skip-link" href="#main">
        {t('Skip to content')}
      </a>
      {isDemo && (
        <div className="demo-bar">
          <span>{t('DESIGN PREVIEW')}</span>
          {t(
            'Example records & illustrated coins · Your collection will connect through Supabase',
          )}
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav aria-label={t('Main navigation')}>
            <NavLink to="/" end>
              {t('Home')}
            </NavLink>
            <NavLink to="/collection">{t('The collection')}</NavLink>
            <NavLink to="/about">{t('About')}</NavLink>
          </nav>
          <div className="header-actions">
            <Link to="/collection" className="header-explore">
              {t('Explore')}
              <ArrowUpRight size={17} />
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collection" element={<Collection />} />
          <Route
            path="/coins/:slug"
            element={<Details key={location.pathname} />}
          />
          <Route path="/admin/login" element={<Login />} />
          <Route element={<AdminGuard />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/coins/new" element={<Editor />} />
            <Route path="/admin/coins/:id/edit" element={<Editor />} />
          </Route>
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <Logo />
          <p>
            {t('A small museum of stories.')}
            <br />
            {t('Collected with curiosity.')}
          </p>
          <Link className="text-link" to="/collection">
            {t('Explore the cabinet')}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="container footer-contact">
          <a href="mailto:admin.my.coins.collection@gmail.com">
            {t('Contact by email')}: admin.my.coins.collection@gmail.com
          </a>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {t('My Coin Collection')}
          </span>
          <span>{t('History is in the details.')}</span>
          <Link to="/about">{t('About this collection')}</Link>
          <Link to="/admin">{t('Administration')}</Link>
        </div>
      </footer>
    </AdminAuth>
  )
}
