// Utility function to get box shadow based on theme
export const getBoxShadow = (isDark: boolean, size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md') => {
    const shadows = {
        sm: {
            light: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            dark: '0 1px 2px 0 rgba(255, 255, 255, 0.05)',
        },
        md: {
            light: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            dark: '0 4px 6px -1px rgba(255, 255, 255, 0.1), 0 2px 4px -2px rgba(255, 255, 255, 0.1)',
        },
        lg: {
            light: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
            dark: '0 10px 15px -3px rgba(255, 255, 255, 0.1), 0 4px 6px -4px rgba(255, 255, 255, 0.1)',
        },
        xl: {
            light: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            dark: '0 20px 25px -5px rgba(255, 255, 255, 0.15), 0 8px 10px -6px rgba(255, 255, 255, 0.15)',
        },
        '2xl': {
            light: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            dark: '0 25px 50px -12px rgba(255, 255, 255, 0.2)',
        },
    }

    return isDark ? shadows[size].dark : shadows[size].light
}

// Utility function for hover shadow transitions
export const getShadowTransition = (isDark: boolean, normalSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl', hoverSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl') => {
    return {
        normal: getBoxShadow(isDark, normalSize),
        hover: getBoxShadow(isDark, hoverSize),
    }
}
