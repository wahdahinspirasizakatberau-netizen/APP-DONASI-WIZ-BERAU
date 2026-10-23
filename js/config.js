tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                wiz: {
                    green: '#27745F',
                    green_dark: '#1B5444',
                    orange: '#F59121',
                    orange_dark: '#D87A15',
                    light: '#F8FAF9'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        }
    }
};

window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && (event.reason.name === 'AbortError' || String(event.reason).includes('The play() request was interrupted'))) {
        event.preventDefault();
    }
});
