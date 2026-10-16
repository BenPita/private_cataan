import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyDocumentLang, getLang, type Lang } from './i18n';
import { installErrorReporting } from './diag';
import { unlockAudio } from './sound';
import { Home } from './screens/Home';
import { Room } from './screens/Room';
import { Recover } from './Recover';
import './styles.css';

applyDocumentLang();
installErrorReporting();
// Browsers only allow audio after a user gesture.
window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

function App() {
  const [path, setPath] = useState(location.pathname);
  const [lang, setLangState] = useState<Lang>(getLang());
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (p: string) => {
    history.pushState(null, '', p);
    setPath(p);
  };
  const match = path.match(/^\/g\/([A-Za-z0-9]+)/);
  // `lang` is part of the key so every screen re-renders in the new language.
  return match ? (
    <Room key={`${match[1]}-${lang}`} roomId={match[1]} navigate={navigate} onLang={setLangState} />
  ) : (
    <Home key={lang} navigate={navigate} onLang={setLangState} />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Recover>
      <App />
    </Recover>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
