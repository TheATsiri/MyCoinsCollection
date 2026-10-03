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
  return (
    <Link to="/" className="brand" aria-label="My Coin Collection home">
      <span className="brand-icon">
        <Coins size={26} strokeWidth={1.3} />
      </span>
      <span>
        My Coin Collection<small>A PERSONAL NUMISMATIC JOURNEY</small>
      </span>
    </Link>
  )
}
export default function App() {
  const location = useLocation()
  useEffect(() => {
    document.getElementById('main')?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {isDemo && (
        <div className="demo-bar">
          <span>DESIGN PREVIEW</span>Example records & illustrated coins · Your
          collection will connect through Supabase
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Logo />
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/collection">The collection</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <Link to="/collection" className="header-explore">
            Explore
            <ArrowUpRight size={17} />
          </Link>
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
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <Logo />
          <p>
            A small museum of stories.
            <br />
            Collected with curiosity.
          </p>
          <Link className="text-link" to="/collection">
            Explore the cabinet
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} My Coin Collection</span>
          <span>History is in the details.</span>
          <Link to="/about">About this collection</Link>
        </div>
      </footer>
    </>
  )
}
