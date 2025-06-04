/**
 * ScreenSpec - Content Script
 * ページ内での注釈機能とキャプチャサポート
 */

class ScreenSpecContent {
    constructor() {
        this.isAnnotationMode = false;
        this.annotations = [];
        this.currentAnnotation = null;
        this.overlay = null;
        this.isCapturing = false;
        
        this.init();
    }

    init() {
        this.setupMessageListener();
        this.loadExternalLibraries();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'startAnnotation':
                    this.startAnnotationMode();
                    sendResponse({ success: true });
                    break;
                case 'stopAnnotation':
                    this.stopAnnotationMode();
                    sendResponse({ success: true });
                    break;
                case 'captureFullPage':
                    await this.captureFullPage(sendResponse);
                    break;
                case 'highlightElement':
                    this.highlightElement(request.selector);
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Content script message handling error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async loadExternalLibraries() {
        try {
            // html2canvasの動的読み込み
            if (typeof html2canvas === 'undefined') {
                await this.loadScript(chrome.runtime.getURL('libs/html2canvas.min.js'));
            }
        } catch (error) {
            console.warn('Failed to load external libraries:', error);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    startAnnotationMode() {
        if (this.isAnnotationMode) return;
        
        this.isAnnotationMode = true;
        this.createOverlay();
        this.setupAnnotationEvents();
        
        // 画面キャプチャモードの視覚フィードバック
        document.body.style.cursor = 'crosshair';
        this.showNotification('注釈モードが開始されました。ESCキーで終了します。');
    }

    stopAnnotationMode() {
        if (!this.isAnnotationMode) return;
        
        this.isAnnotationMode = false;
        this.removeOverlay();
        this.cleanupAnnotationEvents();
        
        document.body.style.cursor = '';
        this.hideNotification();
    }

    createOverlay() {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'screenspec-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.1);
            z-index: 999999;
            pointer-events: none;
            backdrop-filter: blur(1px);
        `;
        
        document.body.appendChild(this.overlay);
    }

    removeOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    setupAnnotationEvents() {
        this.boundKeyHandler = this.handleKeyPress.bind(this);
        this.boundMouseHandler = this.handleMouseMove.bind(this);
        this.boundClickHandler = this.handleClick.bind(this);
        
        document.addEventListener('keydown', this.boundKeyHandler);
        document.addEventListener('mousemove', this.boundMouseHandler);
        document.addEventListener('click', this.boundClickHandler);
    }

    cleanupAnnotationEvents() {
        if (this.boundKeyHandler) {
            document.removeEventListener('keydown', this.boundKeyHandler);
        }
        if (this.boundMouseHandler) {
            document.removeEventListener('mousemove', this.boundMouseHandler);
        }
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler);
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.stopAnnotationMode();
        }
    }

    handleMouseMove(event) {
        if (!this.isAnnotationMode) return;
        
        // マウスオーバーした要素をハイライト
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (element && element !== this.overlay) {
            this.highlightElement(element);
        }
    }

    handleClick(event) {
        if (!this.isAnnotationMode) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (element && element !== this.overlay) {
            this.selectElement(element);
        }
    }

    highlightElement(element) {
        // 既存のハイライトをクリア
        this.clearHighlights();
        
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        // 要素をハイライト
        element.style.outline = '2px solid #3498db';
        element.style.outlineOffset = '2px';
        element.setAttribute('data-screenspec-highlight', 'true');
    }

    clearHighlights() {
        document.querySelectorAll('[data-screenspec-highlight]').forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.removeAttribute('data-screenspec-highlight');
        });
    }

    selectElement(element) {
        // 選択された要素の情報を取得
        const rect = element.getBoundingClientRect();
        const elementInfo = {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            textContent: element.textContent?.substring(0, 100),
            position: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            }
        };
        
        // 注釈パネルを表示
        this.showAnnotationPanel(elementInfo);
    }

    showAnnotationPanel(elementInfo) {
        // 既存のパネルを削除
        this.hideAnnotationPanel();
        
        const panel = document.createElement('div');
        panel.id = 'screenspec-annotation-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            padding: 24px;
            z-index: 1000000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-width: 320px;
            max-width: 400px;
        `;
        
        panel.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #2c3e50;">
                要素注釈
            </div>
            <div style="margin-bottom: 16px; font-size: 14px; color: #7f8c8d;">
                <strong>要素:</strong> ${elementInfo.tagName.toLowerCase()}${elementInfo.id ? '#' + elementInfo.id : ''}${elementInfo.className ? '.' + elementInfo.className.split(' ').join('.') : ''}
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #34495e;">注釈テキスト:</label>
                <textarea id="annotation-text" placeholder="この要素についての説明を入力..." 
                    style="width: 100%; height: 80px; padding: 8px; border: 2px solid #e9ecef; border-radius: 6px; resize: vertical; font-size: 14px;"></textarea>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="save-annotation" style="flex: 1; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 500; cursor: pointer;">
                    保存
                </button>
                <button id="cancel-annotation" style="flex: 1; background: #95a5a6; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 500; cursor: pointer;">
                    キャンセル
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // イベントリスナーを設定
        document.getElementById('save-annotation').addEventListener('click', () => {
            const text = document.getElementById('annotation-text').value.trim();
            if (text) {
                this.saveAnnotation(elementInfo, text);
            }
            this.hideAnnotationPanel();
        });
        
        document.getElementById('cancel-annotation').addEventListener('click', () => {
            this.hideAnnotationPanel();
        });
        
        // テキストエリアにフォーカス
        document.getElementById('annotation-text').focus();
    }

    hideAnnotationPanel() {
        const panel = document.getElementById('screenspec-annotation-panel');
        if (panel) {
            panel.remove();
        }
    }

    saveAnnotation(elementInfo, text) {
        const annotation = {
            id: Date.now().toString(),
            elementInfo,
            text,
            createdAt: new Date().toISOString()
        };
        
        this.annotations.push(annotation);
        
        // バックグラウンドスクリプトに送信
        chrome.runtime.sendMessage({
            action: 'saveAnnotation',
            annotation
        });
        
        this.showNotification('注釈を保存しました');
    }

    async captureFullPage(sendResponse) {
        try {
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas is not loaded');
            }
            
            this.isCapturing = true;
            this.showNotification('ページ全体をキャプチャ中...');
            
            // ページの寸法を取得
            const originalScrollTop = window.pageYOffset;
            const originalScrollLeft = window.pageXOffset;
            
            // ページトップにスクロール
            window.scrollTo(0, 0);
            
            // 短い遅延の後にキャプチャを実行
            setTimeout(async () => {
                try {
                    const canvas = await html2canvas(document.body, {
                        height: document.body.scrollHeight,
                        width: document.body.scrollWidth,
                        useCORS: true,
                        scale: 0.8,
                        logging: false,
                        onclone: (clonedDoc) => {
                            // クローンされたドキュメントから不要な要素を削除
                            const overlay = clonedDoc.getElementById('screenspec-overlay');
                            if (overlay) overlay.remove();
                            
                            const panel = clonedDoc.getElementById('screenspec-annotation-panel');
                            if (panel) panel.remove();
                        }
                    });
                    
                    const dataUrl = canvas.toDataURL('image/png', 0.8);
                    
                    // 元の位置にスクロールを戻す
                    window.scrollTo(originalScrollLeft, originalScrollTop);
                    
                    this.hideNotification();
                    sendResponse({ success: true, dataUrl });
                } catch (error) {
                    console.error('html2canvas error:', error);
                    window.scrollTo(originalScrollLeft, originalScrollTop);
                    this.hideNotification();
                    sendResponse({ success: false, error: error.message });
                } finally {
                    this.isCapturing = false;
                }
            }, 100);
            
        } catch (error) {
            this.isCapturing = false;
            this.hideNotification();
            sendResponse({ success: false, error: error.message });
        }
    }

    showNotification(message, duration = 3000) {
        this.hideNotification();
        
        const notification = document.createElement('div');
        notification.id = 'screenspec-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            z-index: 1000001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => this.hideNotification(), duration);
        }
    }

    hideNotification() {
        const notification = document.getElementById('screenspec-notification');
        if (notification) {
            notification.remove();
        }
    }

    // ページの状態を取得（デバッグ用）
    getPageInfo() {
        return {
            url: window.location.href,
            title: document.title,
            dimensions: {
                scrollHeight: document.documentElement.scrollHeight,
                scrollWidth: document.documentElement.scrollWidth,
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth
            },
            annotations: this.annotations.length
        };
    }

    // 注釈の削除
    clearAllAnnotations() {
        this.annotations = [];
        this.clearHighlights();
        this.showNotification('すべての注釈をクリアしました');
    }
}

// CSS アニメーションを追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(style);

// コンテンツスクリプトの初期化
const screenSpecContent = new ScreenSpecContent();

// デバッグ用のグローバル関数
window.screenSpecContent = screenSpecContent;