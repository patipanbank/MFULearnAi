import React from 'react';
import { FiSun, FiMoon, FiMonitor } from 'react-icons/fi';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  variant?: 'default' | 'compact' | 'icon-only';
  showLabel?: boolean;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'default', 
  showLabel = true,
  className 
}) => {
  const { preferences, setPreferences, applyTheme, getCurrentTheme } = useSettingsStore();
  
  const currentTheme = getCurrentTheme();
  
  const themes = [
    { 
      value: 'light', 
      label: 'Light', 
      icon: FiSun, 
      colors: 'text-amber-500 hover:text-amber-600' 
    },
    { 
      value: 'dark', 
      label: 'Dark', 
      icon: FiMoon, 
      colors: 'text-indigo-500 hover:text-indigo-600' 
    },
    { 
      value: 'auto', 
      label: 'Auto', 
      icon: FiMonitor, 
      colors: 'text-gray-500 hover:text-gray-600' 
    }
  ];

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    setPreferences({ ...preferences, theme });
    applyTheme(theme);
  };

  if (variant === 'icon-only') {
    const currentThemeConfig = themes.find(t => t.value === preferences.theme) || themes[0];
    const Icon = currentThemeConfig.icon;
    
    return (
      <button
        onClick={() => {
          const nextTheme = preferences.theme === 'light' ? 'dark' : 
                          preferences.theme === 'dark' ? 'auto' : 'light';
          handleThemeChange(nextTheme);
        }}
        className={cn(
          'p-2 rounded-lg transition-all duration-200 hover:bg-secondary group',
          className
        )}
        title={`Current: ${currentThemeConfig.label} theme - Click to cycle`}
      >
        <Icon className={cn(
          'h-5 w-5 transition-all duration-200 group-hover:scale-110',
          currentThemeConfig.colors
        )} />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex bg-secondary rounded-lg p-1', className)}>
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = preferences.theme === theme.value;
          
          return (
            <button
              key={theme.value}
              onClick={() => handleThemeChange(theme.value as any)}
              className={cn(
                'p-2 rounded-md transition-all duration-200 relative',
                isActive 
                  ? 'bg-background shadow-sm' 
                  : 'hover:bg-background/50'
              )}
              title={`${theme.label} theme${isActive ? ' (active)' : ''}`}
            >
              <Icon className={cn(
                'h-4 w-4 transition-colors duration-200',
                isActive ? theme.colors : 'text-muted hover:text-primary'
              )} />
              {isActive && (
                <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showLabel && (
        <label className="block text-sm font-medium text-primary">
          Theme Preference
        </label>
      )}
      
      <div className="grid grid-cols-3 gap-2">
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = preferences.theme === theme.value;
          
          return (
            <button
              key={theme.value}
              onClick={() => handleThemeChange(theme.value as any)}
              className={cn(
                'p-3 rounded-lg border text-center transition-all duration-200 group',
                isActive 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-border-hover hover:bg-secondary/50'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mx-auto mb-2 transition-all duration-200 group-hover:scale-110',
                isActive ? theme.colors : 'text-muted group-hover:text-primary'
              )} />
              <div className={cn(
                'text-xs font-medium transition-colors duration-200',
                isActive ? 'text-primary' : 'text-muted group-hover:text-primary'
              )}>
                {theme.label}
              </div>
              {theme.value === 'auto' && (
                <div className="text-xs text-muted mt-1">System</div>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="text-xs text-muted">
        Current: <span className="font-medium text-primary">{currentTheme}</span> mode
        {preferences.theme === 'auto' && (
          <span className="text-muted"> (follows system preference)</span>
        )}
      </div>
    </div>
  );
};

export default ThemeToggle;