import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/fonts.css';
import './styles/design-system.css';
import './styles/tailwind.css';
import './styles/room-buildout.css';
import './styles/hierarchy.css';
import './styles/cluster-delivery.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
