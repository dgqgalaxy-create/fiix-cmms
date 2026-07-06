import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'fiix-ui-theme',
  ...props
}: ThemeProviderProps) {
  const { user } = useAuth();
  
  // Create a user-specific storage key so different users on same machine can have different settings
  const userStorageKey = user ? `${storageKey}-${user.userId || (user as any).id}` : storageKey;

  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(userStorageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    // When user changes, load their specific theme
    const storedTheme = localStorage.getItem(userStorageKey) as Theme;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(defaultTheme);
    }
  }, [userStorageKey, defaultTheme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(userStorageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
