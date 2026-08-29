const themeToggle = document.getElementById('theme-toggle');

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (savedTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        // Fallback to OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    updateThemeIcon();
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    if (newTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
    
    // Dispatch event so Chart.js can update its colors if needed
    window.dispatchEvent(new Event('themeChanged'));
}

function updateThemeIcon() {
    if (!themeToggle) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeToggle.innerHTML = isDark ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
}

if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// Run on load
initTheme();
