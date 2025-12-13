/**
 * market-worker.js - 市场数据后台线程
 * 负责在后台轮询 DexScreener API 获取最新的代币市场数据 (价格、市值、流动性)
 * 避免阻塞主线程 UI 渲染
 */

// ==========================================================================
// 配置项
// ==========================================================================
const CONFIG = {
    // DexScreener API 端点 (BSC 链上的交易对)
    // 交易对地址: 0xc33bacff9141da689875e6381c1932348ab4c5cb
    API_URL: 'https://api.dexscreener.com/latest/dex/pairs/bsc/0xc33bacff9141da689875e6381c1932348ab4c5cb',
    REFRESH_INTERVAL: 30000, // 默认刷新间隔: 30秒
    MAX_RETRIES: 3,          // 最大重试次数
    RETRY_DELAY: 2000        // 重试延迟 (毫秒)
};

// 当前状态缓存
let currentState = {
    marketCap: null,
    liquidity: null,
    priceChange24h: null,
    lastUpdated: null,
    isFetching: false,
    errorCount: 0
};

// 轮询定时器 ID
let intervalId = null;

// ==========================================================================
// 消息处理 (Main Thread <-> Worker)
// ==========================================================================

self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    switch (type) {
        case 'START':
            startPolling();
            break;
        case 'STOP':
            stopPolling();
            break;
        case 'REFRESH':
            fetchMarketData();
            break;
        case 'UPDATE_CONFIG':
             if (payload.refreshInterval) {
                 CONFIG.REFRESH_INTERVAL = payload.refreshInterval;
                 // 如果正在运行，重启以应用新的间隔
                 if (intervalId) {
                     stopPolling();
                     startPolling();
                 }
             }
             break;
    }
};

// ==========================================================================
// 核心逻辑
// ==========================================================================

/**
 * 开始轮询
 */
function startPolling() {
    fetchMarketData(); // 立即执行一次
    intervalId = setInterval(fetchMarketData, CONFIG.REFRESH_INTERVAL);
}

/**
 * 停止轮询
 */
function stopPolling() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

/**
 * 获取市场数据
 * @param {number} retryCount - 当前重试次数
 */
async function fetchMarketData(retryCount = 0) {
    if (currentState.isFetching) return;
    
    currentState.isFetching = true;
    postMessage({ type: 'STATUS', payload: 'FETCHING' });
    
    try {
        const start = performance.now();
        const response = await fetch(CONFIG.API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const end = performance.now();
        
        // 验证数据结构
        if (!data.pairs || data.pairs.length === 0) {
             throw new Error('未找到交易对数据 (No pair data found)');
        }
        
        const pair = data.pairs[0];
        
        // 提取关键指标
        const newData = {
            marketCap: pair.fdv || pair.marketCap || 0, // 优先使用完全稀释估值 (FDV)
            liquidity: pair.liquidity ? pair.liquidity.usd : 0,
            priceChange24h: pair.priceChange ? pair.priceChange.h24 : 0,
            lastUpdated: Date.now(),
            fetchDuration: end - start
        };
        
        // 更新状态
        currentState = { ...currentState, ...newData, isFetching: false, errorCount: 0 };
        
        // 发送数据回主线程
        postMessage({ 
            type: 'DATA_UPDATE', 
            payload: newData 
        });
        
    } catch (error) {
        console.error('市场数据获取失败:', error);
        currentState.isFetching = false;
        currentState.errorCount++;
        
        postMessage({ type: 'ERROR', payload: error.message });
        
        // 简单的重试逻辑
        if (retryCount < CONFIG.MAX_RETRIES) {
            setTimeout(() => {
                fetchMarketData(retryCount + 1);
            }, CONFIG.RETRY_DELAY);
        }
    }
}
