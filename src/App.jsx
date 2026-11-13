import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import logo from './assets/HCMdrugs_logo.png';
import { VersionProvider, useVersion, totalDrugs } from './versions';
import { VersionSelect, VersionBanner, useVersionLink, CompareProvider, useCompare } from './components';
import Overview from './pages/Overview';
import Explorer from './pages/Explorer';
import DrugPage from './pages/DrugPage';
import Compare from './pages/Compare';
import About from './pages/About';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Masthead() {
  const { version } = useVersion();
  const compare = useCompare();
  const to = useVersionLink();
  const navClass = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <Link to={to('/')} className="brand" aria-label="HCMdrugs overview">
            <span className="brand-logo" style={{ '--logo': `url(${logo})` }} />
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to={to('/')} end className={navClass}>Overview</NavLink>
            <NavLink to={to('/explorer')} className={navClass}>Explorer <span className="count">{totalDrugs(version)}</span></NavLink>
            <NavLink to={to('/compare')} className={navClass}>Compare {compare.ids.length > 0 && <span className="count">{compare.ids.length}</span>}</NavLink>
            <NavLink to={to('/about')} className={navClass}>Methods &amp; citation</NavLink>
          </nav>
          <VersionSelect />
        </div>
      </header>
    </>
  );
}

function Footer() {
  const to = useVersionLink();
  return (
    <footer className="footer">
      <div className="wrap">
        <p className="cite">
          Haris M, Rahman S, Qamar MTu, Azeem F. HCMdrugs: a web-based database cataloging the drugs available for the
          treatment of hypertrophic cardiomyopathy. <i>J Comput Biophys Chem.</i> 2026;25(09):1341–1350.
        </p>
        <nav aria-label="Footer">
          <Link to={to('/')}>Overview</Link>
          <Link to={to('/explorer')}>Explorer</Link>
          <Link to={to('/compare')}>Compare</Link>
          <Link to={to('/about')}>Methods &amp; citation</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <Router>
      <VersionProvider>
        <CompareProvider>
          <ScrollToTop />
          <Masthead />
          <VersionBanner />
          <main>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/explorer" element={<Explorer />} />
              <Route path="/drug/:drugId" element={<DrugPage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Overview />} />
            </Routes>
          </main>
          <Footer />
        </CompareProvider>
      </VersionProvider>
    </Router>
  );
}
