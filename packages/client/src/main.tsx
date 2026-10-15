import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './screens/Home';
import { Room } from './screens/Room';
import './styles.css';

function App() {
  const [path, setPath] = useState(location.pathname);
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
  return match ? <Room key={match[1]} roomId={match[1]} navigate={navigate} /> : <Home navigate={navigate} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
