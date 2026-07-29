import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');
createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
