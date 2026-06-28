const lastClearedUrl = new Map();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const url = tab.url;
    if (!url) return;

    const isStudocuDoc = url.includes('studocu.com/vn/document/') || url.includes('studocu.vn/vn/document/');

    if (changeInfo.status === 'loading' && isStudocuDoc) {
        if (lastClearedUrl.get(tabId) !== url) {
            lastClearedUrl.set(tabId, url);
            try {
                const allCookies = await chrome.cookies.getAll({});
                for (const cookie of allCookies) {
                    if (cookie.domain.includes('studocu')) {
                        const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                        const protocol = cookie.secure ? "https:" : "http:";
                        const urlCookie = `${protocol}//${cleanDomain}${cookie.path}`;
                        await chrome.cookies.remove({ url: urlCookie, name: cookie.name, storeId: cookie.storeId });
                    }
                }
                chrome.tabs.reload(tabId);
            } catch (e) {
                console.error(e);
            }
        }
    }
});