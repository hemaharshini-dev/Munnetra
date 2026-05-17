import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const WindowContext = createContext(null);

export function WindowProvider({ children }) {
  const { user } = useAuth();
  const [activeWindow, setActiveWindow] = useState(undefined); // undefined = loading, null = no window

  useEffect(() => {
    if (!user) { setActiveWindow(null); return; }
    api.get('/checkin-windows/active')
      .then(r => setActiveWindow(r.data))
      .catch(() => setActiveWindow(null));
  }, [user]);

  function refresh() {
    if (!user) return;
    api.get('/checkin-windows/active')
      .then(r => setActiveWindow(r.data))
      .catch(() => setActiveWindow(null));
  }

  return (
    <WindowContext.Provider value={{ activeWindow, refresh }}>
      {children}
    </WindowContext.Provider>
  );
}

export const useWindow = () => useContext(WindowContext);
