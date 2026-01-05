import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeSwitcherProps {
    className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className }) => {
    const { theme, setTheme } = useTheme();

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' }
    ];

    return (
        <div className={`flex items-center gap-1 p-1 bg-white/5 rounded-lg ${className || ''}`}>
            {options.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        theme === value
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={label}
                >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
};

// Compact version for toolbars
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
    const { resolvedTheme, setTheme, theme } = useTheme();

    const cycleTheme = () => {
        const order = ['light', 'dark', 'system'] as const;
        const currentIndex = order.indexOf(theme);
        const nextIndex = (currentIndex + 1) % order.length;
        setTheme(order[nextIndex]);
    };

    return (
        <button
            onClick={cycleTheme}
            className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${className || ''}`}
            title={`Theme: ${theme} (${resolvedTheme})`}
        >
            {resolvedTheme === 'dark' ? (
                <Moon className="w-4 h-4 text-gray-400" />
            ) : (
                <Sun className="w-4 h-4 text-yellow-400" />
            )}
        </button>
    );
};
