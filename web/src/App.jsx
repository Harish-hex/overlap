import React, { useEffect, useState } from 'react';
import CreateEvent from './CreateEvent.jsx';
import Dashboard from './Dashboard.jsx';

function parse() {
  const m = location.hash.match(/^#\/admin\/(\w+)\/(\w+)/);
  return m ? { slug: m[1], token: m[2] } : null;
}

export default function App() {
  const [route, setRoute] = useState(parse());
  useEffect(() => {
    const f = () => setRoute(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return (
    <div className="wrap">
      <a className="wordmark" href="#/">Overlap</a>
      {route ? <Dashboard slug={route.slug} token={route.token} /> : <CreateEvent />}
    </div>
  );
}
