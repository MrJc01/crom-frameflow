import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Hook to detect system preference
function useSystemTheme(): ResolvedTheme {
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
        if (typeof window === 'undefined') return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handler = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };
        
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return systemTheme;
}

// Provider component
interface ThemeProviderProps {
    children: ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

export function ThemeProvider({ 
    children, 
    defaultTheme = 'system',
    storageKey = 'frameflow-theme'
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return defaultTheme;
        const stored = localStorage.getItem(storageKey);
        return (stored as Theme) || defaultTheme;
    });

    const systemTheme = useSystemTheme();
    
    const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolvedTheme);
        root.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(storageKey, newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// Hook to use theme
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Standalone hook for components that just need resolved theme
export function useResolvedTheme(): ResolvedTheme {
    const { resolvedTheme } = useTheme();
    return resolvedTheme;
}
