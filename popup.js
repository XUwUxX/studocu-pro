function updateStatus(msgKey, isProcessing = false, dynamicData = null) {
    const statusText = document.getElementById('status-text');
    const statusBar = document.getElementById('status');
    const currentLang = localStorage.getItem('preferredLang') || 'vi';

    // Bộ từ điển riêng cho hàm updateStatus
    const statusTranslations = {
        vi: {
            clearing: "Đang quét và xóa cookie...",
            success: `Đã xóa ${dynamicData} cookies! Đang tải lại...`,
            error: "Lỗi: "
        },
        en: {
            clearing: "Scanning and clearing cookies...",
            success: `Deleted ${dynamicData} cookies! Reloading...`,
            error: "Error: "
        }
    };

    // Xác định nội dung text hiển thị dựa trên key truyền vào
    let msg = msgKey;
    if (statusTranslations[currentLang] && statusTranslations[currentLang][msgKey]) {
        msg = statusTranslations[currentLang][msgKey];
    } else if (msgKey === 'error' && dynamicData) {
        msg = statusTranslations[currentLang]['error'] + dynamicData;
    }

    if (statusText && statusBar) {
        statusText.innerText = msg;
        statusBar.classList.toggle('processing', isProcessing);
    } else {
        const oldStatus = document.getElementById('status');
        if (oldStatus) oldStatus.textContent = msg;
    }
}

// --- LOGIC CHUYỂN ĐỔI NGÔN NGỮ TRÊN POPUP ---
document.addEventListener('DOMContentLoaded', () => {
    const langBtn = document.getElementById('langBtn');
    let currentLang = localStorage.getItem('preferredLang') || 'vi';
    
    function applyLanguage(lang) {
        const elements = document.querySelectorAll('[data-vi][data-en]');
        elements.forEach(el => {
            el.textContent = el.getAttribute(`data-${lang}`);
        });
        if (langBtn) langBtn.textContent = lang === 'vi' ? 'EN' : 'VI';
        document.documentElement.lang = lang;
    }

    applyLanguage(currentLang);

    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'vi' ? 'en' : 'vi';
            localStorage.setItem('preferredLang', currentLang);
            applyLanguage(currentLang);
            
            // Cập nhật lại thanh trạng thái sang ngôn ngữ mới nếu đang ở trạng thái mặc định
            const statusText = document.getElementById('status-text');
            if (statusText && !document.getElementById('status').classList.contains('processing')) {
                statusText.innerText = statusText.getAttribute(`data-${currentLang}`);
            }
        });
    }
});
// --------------------------------------------

document.getElementById('clearBtn').addEventListener('click', async () => {
    updateStatus("clearing", true);
    try {
        const allCookies = await chrome.cookies.getAll({});
        let count = 0;
        for (const cookie of allCookies) {
            if (cookie.domain.includes('studocu')) {
                const cleanDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                const protocol = cookie.secure ? "https:" : "http:";
                const url = `${protocol}//${cleanDomain}${cookie.path}`;
                await chrome.cookies.remove({ url: url, name: cookie.name, storeId: cookie.storeId });
                count++;
            }
        }
        updateStatus("success", false, count);
        setTimeout(async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) await chrome.tabs.reload(tab.id);
        }, 1000);
    } catch (e) {
        updateStatus("error", false, e.message);
    }
});

document.getElementById('checkBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentLang = localStorage.getItem('preferredLang') || 'vi';

    await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["viewer_styles.css"]
    });
    
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: runCleanViewer,
        args: [currentLang] // Truyền ngôn ngữ hiện tại vào trang web
    });
});

function runCleanViewer(lang) {
    // Bộ từ điển thông báo hiển thị trên trang Studocu
    const locales = {
        vi: {
            notFound: "⚠️ Không tìm thấy trang nào.\n(Hãy cuộn chuột xuống cuối tài liệu để web tải hết nội dung trước!)",
            confirm: "Tìm thấy {count} trang.\nBấm OK để xử lý và tạo PDF..."
        },
        en: {
            notFound: "⚠️ No pages found.\n(Please scroll down to the bottom of the document to let the website load all content first!)",
            confirm: "Found {count} pages.\nClick OK to process and create PDF..."
        }
    };

    const text = locales[lang] || locales['vi'];
    const pages = document.querySelectorAll('div[data-page-index]');
    
    if (pages.length === 0) {
        alert(text.notFound);
        return;
    }
    
    const confirmMsg = text.confirm.replace("{count}", pages.length);
    if (!confirm(confirmMsg)) return;

    const SCALE_FACTOR = 4;
    const HEIGHT_SCALE_DIVISOR = 4;

    function copyComputedStyle(source, target, scale, shouldScaleHeight, shouldScaleWidth) {
        const computedStyle = window.getComputedStyle(source);
        const normalProps = [
            'position', 'left', 'top', 'bottom', 'right',
            'font-family', 'font-weight', 'font-style',
            'color', 'background-color',
            'text-align', 'white-space',
            'display', 'visibility', 'opacity', 'z-index',
            'text-shadow', 'unicode-bidi', 'font-feature-settings', 'padding'
        ];
        let styleString = '';
        
        normalProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
                styleString += `${prop}: ${value} !important; `;
            }
        });

        const widthValue = computedStyle.getPropertyValue('width');
        if (widthValue && widthValue !== 'none' && widthValue !== 'auto') {
            if (shouldScaleWidth) {
                const numValue = parseFloat(widthValue);
                if (!isNaN(numValue) && numValue > 0) {
                    const unit = widthValue.replace(numValue.toString(), '');
                    styleString += `width: ${numValue / 4}${unit} !important; `;
                } else {
                    styleString += `width: ${widthValue} !important; `;
                }
            } else {
                styleString += `width: ${widthValue} !important; `;
            }
        }

        const heightValue = computedStyle.getPropertyValue('height');
        if (heightValue && heightValue !== 'none' && heightValue !== 'auto') {
            if (shouldScaleHeight) {
                const numValue = parseFloat(heightValue);
                if (!isNaN(numValue) && numValue > 0) {
                    const unit = heightValue.replace(numValue.toString(), '');
                    styleString += `height: ${numValue / HEIGHT_SCALE_DIVISOR}${unit} !important; `;
                } else {
                    styleString += `height: ${heightValue} !important; `;
                }
            } else {
                styleString += `height: ${heightValue} !important; `;
            }
        }

        ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'auto') {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    if (source.tagName === 'SPAN' && source.classList?.contains('_') && numValue !== 0) {
                        const unit = value.replace(numValue.toString(), '');
                        styleString += `${prop}: ${numValue / scale}${unit} !important; `;
                    } else {
                        styleString += `${prop}: ${value} !important; `;
                    }
                }
            }
        });

        ['font-size', 'line-height'].forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue !== 0) {
                    const unit = value.replace(numValue.toString(), '');
                    styleString += `${prop}: ${numValue / scale}${unit} !important; `;
                } else {
                    styleString += `${prop}: ${value} !important; `;
                }
            }
        });

        const transformOrigin = computedStyle.getPropertyValue('transform-origin');
        if (transformOrigin) {
            styleString += `transform-origin: ${transformOrigin} !important; -webkit-transform-origin: ${transformOrigin} !important; `;
        }
        styleString += 'overflow: visible !important; max-width: none !important; max-height: none !important; clip: auto !important; clip-path: none !important; ';
        target.style.cssText += styleString;
    }

    function deepCloneWithStyles(element, scale, heightScale) {
        const clone = element.cloneNode(false);
        const hasTextClass = element.classList?.contains('t');
        const hasUnderscoreClass = element.classList?.contains('_');
        
        copyComputedStyle(element, clone, scale, hasTextClass, hasUnderscoreClass);
        
        if (element.classList?.contains('pc')) {
            clone.style.setProperty('transform', 'none', 'important');
            clone.style.setProperty('-webkit-transform', 'none', 'important');
            clone.style.setProperty('overflow', 'visible', 'important');
            clone.style.setProperty('max-width', 'none', 'important');
            clone.style.setProperty('max-height', 'none', 'important');
        }
        
        if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
            clone.textContent = element.textContent;
        } else {
            element.childNodes.forEach(child => {
                if (child.nodeType === 1) {
                    clone.appendChild(deepCloneWithStyles(child, scale, heightScale));
                } else if (child.nodeType === 3) {
                    clone.appendChild(child.cloneNode(true));
                }
            });
        }
        return clone;
    }

    const fragment = document.createDocumentFragment();
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'clean-viewer-container';

    pages.forEach((page, index) => {
        const pc = page.querySelector('.pc');
        let width = 595.3;
        let height = 841.9;

        if (pc) {
            const pcStyle = window.getComputedStyle(pc);
            const pcWidth = parseFloat(pcStyle.width);
            const pcHeight = parseFloat(pcStyle.height);
            if (!isNaN(pcWidth) && pcWidth > 0 && !isNaN(pcHeight) && pcHeight > 0) {
                width = pcWidth;
                height = pcHeight;
            } else {
                const rect = pc.getBoundingClientRect();
                if (rect.width > 10 && rect.height > 10) {
                    width = rect.width;
                    height = rect.height;
                }
            }
        }
        
        const newPage = document.createElement('div');
        newPage.className = 'std-page';
        newPage.id = `page-${index + 1}`;
        newPage.setAttribute('data-page-number', index + 1);
        newPage.style.width = `${width}px`;
        newPage.style.height = `${height}px`;

        const originalImg = page.querySelector('img.bi') || page.querySelector('img');
        if (originalImg) {
            const bgLayer = document.createElement('div');
            bgLayer.className = 'layer-bg';
            const imgClone = originalImg.cloneNode(true);
            imgClone.style.cssText = 'width: 100%; height: 100%; object-fit: cover; object-position: top center';
            bgLayer.appendChild(imgClone);
            newPage.appendChild(bgLayer);
        }

        const originalPc = page.querySelector('.pc');
        if (originalPc) {
            const textLayer = document.createElement('div');
            textLayer.className = 'layer-text';
            const pcClone = deepCloneWithStyles(originalPc, SCALE_FACTOR, HEIGHT_SCALE_DIVISOR);
            pcClone.querySelectorAll('img').forEach(img => img.style.display = 'none');
            textLayer.appendChild(pcClone);
            newPage.appendChild(textLayer);
        }
        viewerContainer.appendChild(newPage);
    });

    fragment.appendChild(viewerContainer);
    document.body.appendChild(fragment);
    
    setTimeout(() => {
        window.print();
    }, 1000);
}
