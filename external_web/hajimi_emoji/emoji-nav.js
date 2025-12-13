
// 导航栏逻辑与主站保持一致
// State
let navTranslations = {};
let currentNavLang = localStorage.getItem('hajimi_lang') || 'zh';

// DOM Elements
const navbar = document.getElementById('navbar');
const mobileMenu = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const langSwitch = document.getElementById('lang-switch');

// Init
async function initNav() {
    try {
        const res = await fetch('/data/i18n.json');
        navTranslations = await res.json();
        updateNavLanguage();
    } catch (e) {
        console.error('Failed to load nav i18n:', e);
    }
}

// Update Language
function updateNavLanguage() {
    // Update navbar texts
    document.querySelectorAll('.navbar [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (navTranslations[currentNavLang] && navTranslations[currentNavLang][key]) {
            el.textContent = navTranslations[currentNavLang][key];
        }
    });

    // Update lang switch text
    const currentLangSpan = document.querySelector('.current-lang');
    if (currentLangSpan) {
        currentLangSpan.textContent = currentNavLang === 'en' ? 'English' : '中文';
    }
    
    // Update lang dropdown selected state
    document.querySelectorAll('.lang-dropdown li').forEach(li => {
        if (li.getAttribute('data-lang') === currentNavLang) {
            li.classList.add('selected'); // Optional styling
        } else {
            li.classList.remove('selected');
        }
    });
}

// Language Switcher Logic
if (langSwitch) {
    langSwitch.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitch.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!langSwitch.contains(e.target)) {
            langSwitch.classList.remove('active');
        }
    });

    const dropdown = langSwitch.querySelector('.lang-dropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const target = e.target.closest('li');
            if (target && target.hasAttribute('data-lang')) {
                const newLang = target.getAttribute('data-lang');
                if (newLang) {
                    currentNavLang = newLang;
                    localStorage.setItem('hajimi_lang', newLang);
                    updateNavLanguage();
                    
                    // Sync with page content if exposed
                    if (typeof window.setPageLanguage === 'function') {
                        window.setPageLanguage(newLang);
                    } else if (typeof window.setLanguage === 'function') {
                         window.setLanguage(newLang);
                    } else if (typeof window.setTexts === 'function') {
                        // Fallback: update global lang variable if accessible
                        if (typeof window.lang !== 'undefined') {
                            window.lang = newLang;
                            window.setTexts();
                        } else {
                            location.reload();
                        }
                    } else {
                        location.reload();
                    }
                }
            }
        });
    }
}

// Mobile Menu
if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
}

// Mobile Submenu Toggle
document.querySelectorAll('.has-submenu > .nav-link').forEach(item => {
    item.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            e.preventDefault();
            // Toggle the submenu of this specific item
            const parent = item.parentElement;
            parent.classList.toggle('active');
        }
    });
});

// Scroll Effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Toast & Popup
window.showToast = function(message, duration = 2000) {
    let existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, duration);
};

window.showPopup = function(event) {
    if (event) event.preventDefault();
    const loadingText = currentNavLang === 'zh' ? '功能开发中...' : 'Coming Soon...';
    const text = (navTranslations[currentNavLang] && navTranslations[currentNavLang]['popup_loading']) || loadingText;
    showToast(text);
};

// Initialize
document.addEventListener('DOMContentLoaded', initNav);
