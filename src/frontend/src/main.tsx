import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 👇 这一行直接解决 TS2345 报错
const root = document.getElementById('root')!;

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);