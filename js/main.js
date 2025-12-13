/**
 * main.js - 主站核心逻辑脚本
 * 包含：初始化、导航栏、多语言、市场数据、UI交互等功能
 */

// ==========================================================================
// 全局变量与状态管理
// ==========================================================================
const mobileMenu = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const navbar = document.getElementById('navbar');

// 状态对象
let translations = {}; // 翻译数据缓存
let appsConfig = {};   // 应用配置缓存
let currentLang = localStorage.getItem('hajimi_lang') || 'zh'; // 当前语言，默认中文

// 市场数据相关的 DOM 缓存 (性能优化)
const marketEls = {
    mcap: null,
    liq: null,
    change: null
};

// ==========================================================================
// 初始化逻辑
// ==========================================================================

/**
 * 应用程序主初始化入口
 * 并行加载配置，渲染导航，初始化语言和预加载资源
 */
async function init() {
    try {
        // 并行加载 i18n 和 apps 配置，添加时间戳防止缓存
        const [i18nRes, appsRes] = await Promise.all([
            fetch('/data/i18n.json?t=' + new Date().getTime()),
            fetch('/data/apps.json?t=' + new Date().getTime())
        ]);
        
        translations = await i18nRes.json();
        appsConfig = await appsRes.json();

        // 1. 渲染导航栏结构
        renderNavigation();
        
        // 2. 初始化语言显示
        updateContent();
        
        // 3. 预加载关键应用资源 (性能优化)
        preloadApps();
        
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 页面加载完成后启动各个模块
document.addEventListener('DOMContentLoaded', () => {
    init();              // 核心数据加载
    initMarketWorker();  // 市场数据 Web Worker
    initNav();           // 导航栏交互
    initBuySidebar();    // 右侧购买浮动栏
    // initTvPlayer();      // 电视机播放器 (已移除)
    initLoadingScreen(); // 加载页动画
});

// ==========================================================================
// 导航栏模块 (Navigation)
// ==========================================================================

/**
 * 初始化导航栏交互事件
 */
function initNav() {
    console.log('[Init] 导航栏初始化开始');
    const mobileMenuBtn = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    
    // 移动端菜单切换逻辑
    if (mobileMenuBtn && navMenu) {
        console.log('[Init] 找到移动端菜单元素');
        
        // 点击汉堡菜单图标
        mobileMenuBtn.onclick = function(e) {
            console.log('[Event] 移动端菜单点击');
            e.stopPropagation(); // 防止事件冒泡
            
            // 切换激活状态
            mobileMenuBtn.classList.toggle('active');
            navMenu.classList.toggle('active');
        };

        // 点击菜单外部关闭菜单
        document.addEventListener('click', function(e) {
            if (navMenu.classList.contains('active') && 
                !navMenu.contains(e.target) && 
                !mobileMenuBtn.contains(e.target)) {
                
                navMenu.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
            }
        });
    } else {
        console.error('[Init] 未找到移动端菜单元素');
    }
}

/**
 * 根据 appsConfig 动态渲染导航栏结构
 */
function renderNavigation() {
    if (!appsConfig.menu_structure) return;
    
    const menuContainer = document.querySelector('.nav-menu');
    menuContainer.innerHTML = ''; // 清空现有菜单

    appsConfig.menu_structure.forEach(item => {
        const li = document.createElement('li');
        
        // 处理含有子菜单的项
        if (item.submenu) {
            li.className = 'has-submenu';
            li.innerHTML = `
                <a href="${item.href}" class="nav-link">
                    <span data-i18n="${item.key}">${getText(item.key)}</span> 
                    <i class="fas fa-caret-down"></i>
                </a>
                <ul class="submenu"></ul>
            `;
            
            const ul = li.querySelector('.submenu');
            item.submenu.forEach(subItem => {
                const subLi = document.createElement('li');
                let linkHtml = '';
                
                // 情况 1: 引用应用配置 (App Reference)
                if (subItem.app_id) {
                    const app = appsConfig.apps.find(a => a.id === subItem.app_id);
                    if (app) {
                        linkHtml = `<a href="${app.path}" data-i18n="${app.title_key}">${getText(app.title_key)}</a>`;
                    }
                } 
                // 情况 2: 引用链接配置 (Link Reference)
                else if (subItem.link_id) {
                    const link = appsConfig.links.find(l => l.id === subItem.link_id);
                    if (link) {
                        linkHtml = `<a href="${link.url}" target="${link.target || '_self'}" data-i18n="${link.title_key}">${getText(link.title_key)}</a>`;
                    }
                }
                // 情况 3: 手动配置项 (Manual Item)
                else {
                    const actionAttr = subItem.action ? `onclick="${subItem.action}(event)"` : '';
                    const href = subItem.url || '#';
                    const target = subItem.target ? `target="${subItem.target}"` : '';
                    const text = subItem.key ? getText(subItem.key) : subItem.title;
                    const dataI18n = subItem.key ? `data-i18n="${subItem.key}"` : '';
                    
                    linkHtml = `<a href="${href}" ${target} ${actionAttr} ${dataI18n}>${text}</a>`;
                }
                
                subLi.innerHTML = linkHtml;
                ul.appendChild(subLi);
            });
            
        } else {
            // 普通菜单项 (支持 link_id, app_id 和 target)
            let linkHtml = '';
            
            if (item.link_id) {
                const link = appsConfig.links.find(l => l.id === item.link_id);
                if (link) {
                    linkHtml = `<a href="${link.url}" target="${link.target || '_self'}" class="nav-link" data-i18n="${link.title_key}">${getText(link.title_key)}</a>`;
                }
            } else if (item.app_id) {
                const app = appsConfig.apps.find(a => a.id === item.app_id);
                if (app) {
                    linkHtml = `<a href="${app.path}" class="nav-link" data-i18n="${app.title_key}">${getText(app.title_key)}</a>`;
                }
            } else {
                const target = item.target ? `target="${item.target}"` : '';
                linkHtml = `<a href="${item.href}" ${target} class="nav-link" data-i18n="${item.key}">${getText(item.key)}</a>`;
            }
            
            li.innerHTML = linkHtml;
        }
        
        menuContainer.appendChild(li);
    });

    // 重新绑定移动端特定事件 (因为 DOM 已被重写)
    bindMobileEvents();
}

/**
 * 绑定移动端特有的交互事件
 */
function bindMobileEvents() {
    // 移动端子菜单点击展开/收起
    const menuItemsWithSubmenu = document.querySelectorAll('.has-submenu > .nav-link');
    menuItemsWithSubmenu.forEach(item => {
        item.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                e.preventDefault(); 
                const parent = item.parentElement;
                parent.classList.toggle('active');
            }
        });
    });

    // 点击普通链接后自动关闭移动端菜单
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        const allLinks = navMenu.querySelectorAll('a');
        allLinks.forEach(link => {
            // 如果不是展开子菜单的按钮，则点击后关闭整个菜单
            if (link.parentElement && !link.parentElement.classList.contains('has-submenu')) {
                 link.addEventListener('click', () => {
                    if (window.innerWidth <= 992) {
                        navMenu.classList.remove('active');
                        // 同时移除汉堡按钮的激活状态
                        const mobileBtn = document.getElementById('mobile-menu');
                        if (mobileBtn) mobileBtn.classList.remove('active');
                    }
                });
            }
        });
    }
}

// 滚动监听 - 改变导航栏背景样式
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ==========================================================================
// 多语言模块 (i18n)
// ==========================================================================

/**
 * 获取指定键的翻译文本
 * @param {string} key - 翻译键值
 * @returns {string} 翻译后的文本或原键值
 */
function getText(key) {
    if (!translations[currentLang]) return key;
    return translations[currentLang][key] || translations['zh'][key] || key;
}

/**
 * 更新页面所有带有 data-i18n 属性的元素内容
 */
function updateContent() {
    if (!translations[currentLang]) return;

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            element.innerHTML = translations[currentLang][key];
        }
    });
    
    // 更新语言切换按钮显示的文本
    const currentLangSpan = document.querySelector('.current-lang');
    if (currentLangSpan) {
        currentLangSpan.innerText = currentLang === 'en' ? 'English' : '中文';
    }
    
    // 更新 HTML 标签的 lang 属性
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';

    // 语言改变可能导致文字长度变化，重新计算标题字体大小
    setTimeout(adjustTitleFontSizes, 50);
}

/**
 * 设置当前语言并持久化
 * @param {string} lang - 语言代码 ('zh' 或 'en')
 */
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('hajimi_lang', lang);
    updateContent();
}

// 语言切换下拉菜单逻辑
const langSwitch = document.getElementById('lang-switch');
if (langSwitch) {
    // 点击切换下拉显示
    langSwitch.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitch.classList.toggle('active');
    });
    
    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (!langSwitch.contains(e.target)) {
            langSwitch.classList.remove('active');
        }
    });

    // 下拉项点击事件委托
    const dropdown = langSwitch.querySelector('.lang-dropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.target.closest('li');
            
            if (target && target.hasAttribute('data-lang')) {
                const lang = target.getAttribute('data-lang');
                console.log('Language selected:', lang);
                setLanguage(lang);
                langSwitch.classList.remove('active');
            }
        });
    }
}

// ==========================================================================
// 市场数据模块 (Market Data)
// ==========================================================================

let marketWorker = null;
const MARKET_UPDATE_THROTTLE = 1000; // UI 更新节流时间：1秒
let lastUIUpdate = 0;

/**
 * 初始化市场数据 Web Worker
 */
function initMarketWorker() {
    // 缓存 DOM 元素，避免在 handleMarketData 中重复查询
    marketEls.mcap = document.getElementById('market-cap-value');
    marketEls.liq = document.getElementById('liquidity-value');
    marketEls.change = document.getElementById('change-value');

    if (window.Worker) {
        marketWorker = new Worker('/js/market-worker.js');
        
        marketWorker.onmessage = function(e) {
            const { type, payload } = e.data;
            
            switch (type) {
                case 'DATA_UPDATE':
                    handleMarketData(payload);
                    break;
                case 'ERROR':
                    console.error('Market Worker Error:', payload);
                    break;
            }
        };

        // 开始轮询
        marketWorker.postMessage({ type: 'START' });
        
        // 启动简单的资源监控
        startResourceMonitor();
        
    } else {
        console.warn('当前浏览器不支持 Web Workers');
    }
}

/**
 * 处理并展示市场数据
 * @param {Object} data - 市场数据对象
 */
function handleMarketData(data) {
    const now = Date.now();
    if (now - lastUIUpdate < MARKET_UPDATE_THROTTLE) return;
    lastUIUpdate = now;

    // 格式化数字：紧凑格式 (例如 22.06M)
    const formatCompact = (num) => {
        return new Intl.NumberFormat('en-US', { 
            notation: "compact", 
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(num);
    };
    
    // 格式化百分比
    const formatPercent = (num) => {
        const sign = num > 0 ? '+' : '';
        return `${sign}${num.toFixed(2)}%`;
    };

    // 更新 DOM
    if (marketEls.mcap) marketEls.mcap.innerText = formatCompact(data.marketCap);
    if (marketEls.liq) marketEls.liq.innerText = formatCompact(data.liquidity);
    
    if (marketEls.change) {
        marketEls.change.innerText = formatPercent(data.priceChange24h);
        marketEls.change.className = 'market-value ' + (data.priceChange24h >= 0 ? 'text-green' : 'text-red');
    }
}

/**
 * 资源监控：如果内存占用过高，降低刷新频率
 */
function startResourceMonitor() {
    setInterval(() => {
        if (performance && performance.memory) {
            const usedJSHeapSize = performance.memory.usedJSHeapSize;
            const jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
            
            // 如果堆内存使用超过 80%
            if (usedJSHeapSize > jsHeapSizeLimit * 0.8) {
                console.warn('检测到高内存使用，降低市场数据刷新频率...');
                marketWorker.postMessage({ 
                    type: 'UPDATE_CONFIG', 
                    payload: { refreshInterval: 60000 } // 降至 60秒
                });
            }
        }
    }, 10000); // 每10秒检查一次
}

// ==========================================================================
// UI 交互与工具模块
// ==========================================================================

/**
 * 初始化右侧购买浮动栏 (Buy Sidebar)
 */
function initBuySidebar() {
    const sidebar = document.getElementById('buy-sidebar');
    if (!sidebar) return;

    // 点击切换显示/隐藏
    sidebar.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    // 滚动自动收回逻辑
    let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    let scrollThreshold = 100; // 滑动阈值
    let accumulatedScroll = 0;

    window.addEventListener('scroll', () => {
        if (!sidebar.classList.contains('active')) {
            accumulatedScroll = 0;
            lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            return;
        }

        const st = window.pageYOffset || document.documentElement.scrollTop;
        const delta = Math.abs(st - lastScrollTop);
        
        accumulatedScroll += delta;
        lastScrollTop = st;

        if (accumulatedScroll > scrollThreshold) {
            sidebar.classList.remove('active');
            accumulatedScroll = 0;
        }
    }, { passive: true });
}

/**
 * 复制合约地址功能
 */
const caBar = document.getElementById('ca-bar');
if (caBar) {
    caBar.addEventListener('click', () => {
        // 优先使用 data-copy-value 属性，如果没有则回退到 innerText
        const textToCopy = caBar.getAttribute('data-copy-value') || caBar.innerText.trim(); 
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast(getText('copy_success'));
        }).catch(err => {
            console.error('Clipboard API 失败，尝试 fallback: ', err);
            // Fallback 方案
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast(getText('copy_success'));
            } catch (err) {
                console.error('复制失败', err);
                showToast(getText('copy_fail'));
            }
            document.body.removeChild(textArea);
        });
    });
}

/**
 * 显示 Toast 提示消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长 (毫秒)
 */
function showToast(message, duration = 500) {
    const ANIMATION_IN = 150;  // 出现动画时长
    const DURATION_STAY = duration; // 停留时长
    const ANIMATION_OUT = 300; // 消失动画时长
    
    // 移除已存在的 toast
    let existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    
    document.body.appendChild(toast);
    
    // 触发出现动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 定时触发消失动画
    setTimeout(() => {
        toast.classList.remove('show');
        
        // 动画结束后移除 DOM
        setTimeout(() => {
            if (toast.parentElement) {
                document.body.removeChild(toast);
            }
        }, ANIMATION_OUT); 
    }, ANIMATION_IN + DURATION_STAY);
}

/**
 * 显示“敬请期待”或加载中弹窗
 */
function showPopup(event) {
    if (event) {
        event.preventDefault();
    }
    showToast(getText('popup_loading'), 2000);
}

/**
 * 预加载应用资源 (性能优化)
 */
function preloadApps() {
    if (!appsConfig.apps) return;
    
    appsConfig.apps.forEach(app => {
        if (app.preload) {
            // 检查是否已经存在，避免重复添加
            if (!document.head.querySelector(`link[href="${app.path}"]`)) {
                const link = document.createElement('link');
                link.rel = 'prefetch'; // 或 'prerender'
                link.href = app.path;
                document.head.appendChild(link);
                console.log(`[Preload] 预加载: ${app.path}`);
            }
        }
    });
}

/**
 * 自适应标题字体大小
 * 根据容器宽度自动调整字体大小，防止溢出
 */
function adjustTitleFontSizes() {
    const headers = [
        { header: '.about-header', title: '.about-title', deco: '.about-deco' },
        { header: '.contract-header', title: '.contract-title', deco: '.contract-deco' },
        { header: '.history-header', title: '.history-title', deco: '.history-deco' },
        { header: '.community-header', title: '.community-title', deco: '.community-deco' }
    ];

    headers.forEach(config => {
        const headerEls = document.querySelectorAll(config.header);
        
        headerEls.forEach(headerEl => {
            const titleEl = headerEl.querySelector(config.title);
            const decoEls = headerEl.querySelectorAll(config.deco);

            if (!titleEl) return;

            // 1. 重置字体大小以便准确测量
            titleEl.style.fontSize = '';
            
            // 2. 计算可用宽度
            const containerWidth = headerEl.clientWidth;
            if (containerWidth === 0) return;

            let decoWidth = 0;
            decoEls.forEach(el => {
                decoWidth += el.getBoundingClientRect().width;
            });

            const gap = 20; // 安全间距
            const availableWidth = containerWidth - decoWidth - gap;

            if (availableWidth <= 0) return;

            // 3. 测量当前文本宽度
            const textWidth = titleEl.scrollWidth;

            // 4. 如果溢出则缩小字体
            if (textWidth > availableWidth) {
                const computedStyle = window.getComputedStyle(titleEl);
                const currentFontSize = parseFloat(computedStyle.fontSize);
                
                const ratio = availableWidth / textWidth;
                let newFontSize = Math.floor(currentFontSize * ratio * 0.95); // 0.95 缓冲系数

                newFontSize = Math.max(newFontSize, 12); // 最小字体限制

                titleEl.style.fontSize = `${newFontSize}px`;
            }
        });
    });
}

// 窗口大小改变时重新计算字体
window.addEventListener('resize', () => {
    requestAnimationFrame(adjustTitleFontSizes);
});

// ==========================================================================
// 页面加载进度条模块
// ==========================================================================

function initLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    // 如果加载页被隐藏（例如已有缓存标记），则跳过
    if (!loadingScreen || loadingScreen.style.display === 'none') return;

    let progress = 0;
    
    // 模拟进度条增长
    const interval = setInterval(() => {
        if (progress < 80) {
            progress += Math.random() * 5 + 2; // 快速增长
        } else if (progress < 95) {
            progress += Math.random() * 1; // 慢速逼近
        }
        
        if (progress > 95) progress = 95; // 封顶等待 load 事件

        updateProgress(progress);
    }, 100);

    function updateProgress(val) {
        if (progressBar) progressBar.style.width = val + '%';
        if (progressText) progressText.innerText = Math.floor(val) + '%';
    }

    // 真实页面加载完成
    window.addEventListener('load', () => {
        clearInterval(interval);
        updateProgress(100); 

        // 再次调用自适应计算，确保图片加载完成后的布局正确
        adjustTitleFontSizes();

        // 稍微停留展示 100% 状态
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                // 记录已访问状态
                localStorage.setItem('hasVisited', 'true');
            }, 500); // 等待淡出动画
        }, 500); // 停留 500ms
    });
}

// ==========================================================================
// 电视机播放器模块 (已弃用)
// ==========================================================================

// function initTvPlayer() {
//     const playerContainer = document.querySelector('.tv-player-container');
//     if (!playerContainer) return;

//     const video = playerContainer.querySelector('.tv-video');
    
//     const getVideoSrc = () => {
//         return currentLang === 'en' ? '/images/tv_en.mp4' : '/images/tv_cn.mp4';
//     };

//     const playVideo = () => {
//         const src = getVideoSrc();
        
//         if (video.paused || video.ended) {
//             // 检查当前源是否匹配当前语言，不匹配则重新加载
//             const filename = src.split('/').pop();
//             if (!video.src || !video.src.includes(filename)) {
//                 video.src = src;
//                 video.load();
//             }
            
//             video.play().then(() => {
//                 playerContainer.classList.add('playing');
//                 video.controls = true;
//             }).catch(e => console.error('Play failed:', e));
//         } else {
//             video.pause();
//         }
//     };

//     playerContainer.addEventListener('click', (e) => {
//         // 如果点击的是原生控制条，则不触发自定义点击逻辑
//         if (e.target.tagName === 'VIDEO' && video.controls) return;
//         playVideo();
//     });
    
//     video.addEventListener('pause', () => {
//         playerContainer.classList.remove('playing');
//         video.controls = false;
//     });

//     video.addEventListener('play', () => {
//         playerContainer.classList.add('playing');
//         video.controls = true;
//     });
    
//     video.addEventListener('ended', () => {
//         playerContainer.classList.remove('playing');
//         video.controls = false;
//         video.currentTime = 0;
//     });
// }
