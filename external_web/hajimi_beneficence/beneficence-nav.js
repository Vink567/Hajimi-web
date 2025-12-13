/**
 * beneficence-nav.js - 慈善页面导航栏逻辑
 * 处理导航栏的响应式交互、多语言切换及通用UI效果
 */

// ==========================================================================
// 全局状态与 DOM 元素
// ==========================================================================
let navTranslations = {}; // 导航翻译缓存
let currentNavLang = localStorage.getItem('hajimi_lang') || 'zh'; // 当前语言

// DOM 元素引用
const navbar = document.getElementById('navbar');
const mobileMenu = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const langSwitch = document.getElementById('lang-switch');

// ==========================================================================
// 初始化与核心逻辑
// ==========================================================================

/**
 * 初始化导航栏
 * 加载 i18n 配置并更新界面
 */
async function initNav() {
    try {
        // 添加时间戳防止缓存
        const res = await fetch('/data/i18n.json?t=' + new Date().getTime());
        navTranslations = await res.json();
        updateNavLanguage();
    } catch (e) {
        console.error('加载导航栏翻译失败:', e);
    }
}

/**
 * 更新导航栏语言显示
 */
function updateNavLanguage() {
    // 1. 更新导航链接文本
    document.querySelectorAll('.navbar [data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (navTranslations[currentNavLang] && navTranslations[currentNavLang][key]) {
            el.textContent = navTranslations[currentNavLang][key];
        }
    });

    // 2. 更新语言切换按钮文本
    const currentLangSpan = document.querySelector('.current-lang');
    if (currentLangSpan) {
        currentLangSpan.textContent = currentNavLang === 'en' ? 'English' : '中文';
    }
    
    // 3. 更新下拉菜单选中状态
    document.querySelectorAll('.lang-dropdown li').forEach(li => {
        if (li.getAttribute('data-lang') === currentNavLang) {
            li.classList.add('selected'); 
        } else {
            li.classList.remove('selected');
        }
    });
}

// ==========================================================================
// 交互事件监听
// ==========================================================================

// 语言切换器逻辑
if (langSwitch) {
    // 点击切换下拉菜单显示
    langSwitch.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitch.classList.toggle('active');
    });

    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!langSwitch.contains(e.target)) {
            langSwitch.classList.remove('active');
        }
    });

    // 下拉项点击处理
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
                    
                    // 尝试同步页面其他部分的语言设置
                    // 检查页面是否暴露了语言设置函数
                    if (typeof window.setPageLanguage === 'function') {
                        window.setPageLanguage(newLang);
                    } else if (typeof window.setLanguage === 'function') {
                         window.setLanguage(newLang);
                    } else if (typeof window.setTexts === 'function') {
                        // 降级方案：更新全局变量并调用更新函数
                        if (typeof window.lang !== 'undefined') {
                            window.lang = newLang;
                            window.setTexts();
                        } else {
                            location.reload(); // 最后的手段：刷新页面
                        }
                    } else {
                        location.reload();
                    }
                }
            }
        });
    }
}

// 移动端菜单开关
if (mobileMenu) {
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
}

// 移动端子菜单展开/收起
document.querySelectorAll('.has-submenu > .nav-link').forEach(item => {
    item.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            e.preventDefault();
            // 仅切换当前点击项的子菜单
            const parent = item.parentElement;
            parent.classList.toggle('active');
        }
    });
});

// 滚动监听 - 改变导航栏背景
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ==========================================================================
// 通用 UI 工具函数 (Toast & Popup)
// ==========================================================================

/**
 * 全局 Toast 提示函数
 * @param {string} message 
 * @param {number} duration 
 */
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

/**
 * 全局弹窗函数 (用于 "敬请期待" 等场景)
 * @param {Event} event 
 */
window.showPopup = function(event) {
    if (event) event.preventDefault();
    const loadingText = currentNavLang === 'zh' ? '功能开发中...' : 'Coming Soon...';
    // 优先尝试从翻译配置中获取，否则使用默认文本
    const text = (navTranslations[currentNavLang] && navTranslations[currentNavLang]['popup_loading']) || loadingText;
    showToast(text);
};

// 启动初始化
document.addEventListener('DOMContentLoaded', initNav);
