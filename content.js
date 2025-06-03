class ScreenSpecContent {
    constructor() {
        this.isAnnotationMode = false;
        this.currentScreenId = null;
        this.annotations = [];
        this.init();
    }

    init() {
        // メッセージリスナーを設定
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // html2canvasライブラリの動的読み込み
        this.loadLibraries();
    }

    async loadLibraries() {
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('libs/html2canvas.min.js');
            document.head.appendChild(script);
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'captureFullPage':
                this.captureFullPage();
                break;
            case 'startAnnotation':
                this.startAnnotationMode(message.screenId);
                break;
            case 'ping':
                sendResponse({ status: 'ready' });
                break;
        }
    }

    async captureFullPage() {
        try {
            // html2canvasが読み込まれるまで待機
            await this.waitForLibrary('html2canvas');

            // フルページキャプチャ
            const canvas = await html2canvas(document.body, {
                height: Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                ),
                width: Math.max(
                    document.body.scrollWidth,
                    document.body.offsetWidth,
                    document.documentElement.clientWidth,
                    document.documentElement.scrollWidth,
                    document.documentElement.offsetWidth
                ),
                useCORS: true,
                allowTaint: true,
                scale: 1
            });

            const dataUrl = canvas.toDataURL('image/png');
            
            // バックグラウンドスクリプトに結果を送信
            chrome.runtime.sendMessage({
                action: 'fullPageCaptured',
                dataUrl: dataUrl,
                url: window.location.href,
                title: document.title
            });

        } catch (error) {
            console.error('フルページキャプチャエラー:', error);
            chrome.runtime.sendMessage({
                action: 'captureError',
                error: error.message
            });
        }
    }

    waitForLibrary(libraryName) {
        return new Promise((resolve) => {
            const checkLibrary = () => {
                if (window[libraryName]) {
                    resolve();
                } else {
                    setTimeout(checkLibrary, 100);
                }
            };
            checkLibrary();
        });
    }

    async startAnnotationMode(screenId) {
        if (this.isAnnotationMode) return;

        this.isAnnotationMode = true;
        this.currentScreenId = screenId;

        // 保存済みの注釈データを読み込み
        await this.loadAnnotations(screenId);

        // 注釈オーバーレイを作成
        this.createAnnotationOverlay();
        
        // キーボードイベントを設定
        this.setupKeyboardEvents();
    }

    async loadAnnotations(screenId) {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screen = screens.find(s => s.id === screenId);
            if (screen && screen.annotations) {
                this.annotations = screen.annotations;
            }
        } catch (error) {
            console.error('注釈読み込みエラー:', error);
        }
    }

    createAnnotationOverlay() {
        // 既存のオーバーレイを削除
        const existingOverlay = document.getElementById('screenspec-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // オーバーレイコンテナを作成
        const overlay = document.createElement('div');
        overlay.id = 'screenspec-overlay';
        overlay.innerHTML = `
            <div id="screenspec-toolbar">
                <div class="toolbar-section">
                    <button id="annotation-text" class="tool-btn active" title="テキスト注釈">📝</button>
                    <button id="annotation-arrow" class="tool-btn" title="矢印">➡️</button>
                    <button id="annotation-box" class="tool-btn" title="枠線">⬜</button>
                    <button id="annotation-highlight" class="tool-btn" title="ハイライト">🖍️</button>
                </div>
                <div class="toolbar-section">
                    <button id="annotation-save" class="save-btn">💾 保存</button>
                    <button id="annotation-close" class="close-btn">✕ 閉じる</button>
                </div>
            </div>
            <div id="screenspec-canvas-container">
                <canvas id="screenspec-canvas"></canvas>
            </div>
        `;

        // スタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            #screenspec-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                z-index: 999999;
                display: flex;
                flex-direction: column;
            }

            #screenspec-toolbar {
                background: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }

            .toolbar-section {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .tool-btn {
                padding: 8px 12px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }

            .tool-btn:hover {
                background: #f8f9fa;
                transform: translateY(-1px);
            }

            .tool-btn.active {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }

            .save-btn {
                padding: 8px 16px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            }

            .close-btn {
                padding: 8px 16px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            }

            #screenspec-canvas-container {
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: auto;
                padding: 20px;
            }

            #screenspec-canvas {
                max-width: 100%;
                max-height: 100%;
                border: 2px solid white;
                border-radius: 8px;
                cursor: crosshair;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // イベントリスナーを設定
        this.setupAnnotationEvents();
        
        // キャプチャ画像をcanvasに描画
        this.loadScreenToCanvas();
    }

    async loadScreenToCanvas() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screen = screens.find(s => s.id === this.currentScreenId);
            
            if (!screen) return;

            const canvas = document.getElementById('screenspec-canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // 既存の注釈を描画
                this.renderAnnotations();
            };

            img.src = screen.dataUrl;
        } catch (error) {
            console.error('画像読み込みエラー:', error);
        }
    }

    setupAnnotationEvents() {
        // ツールボタンのイベント
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // 保存ボタン
        document.getElementById('annotation-save').addEventListener('click', () => {
            this.saveAnnotations();
        });

        // 閉じるボタン
        document.getElementById('annotation-close').addEventListener('click', () => {
            this.closeAnnotationMode();
        });

        // Canvasのクリックイベント
        const canvas = document.getElementById('screenspec-canvas');
        canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
    }

    handleCanvasClick(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const activeTool = document.querySelector('.tool-btn.active').id;
        
        if (activeTool === 'annotation-text') {
            this.addTextAnnotation(x, y);
        }
    }

    addTextAnnotation(x, y) {
        const text = prompt('注釈テキストを入力してください:');
        if (!text) return;

        const annotation = {
            id: Date.now().toString(),
            type: 'text',
            x: x,
            y: y,
            text: text,
            timestamp: new Date().toISOString()
        };

        this.annotations.push(annotation);
        this.renderAnnotations();
    }

    renderAnnotations() {
        const canvas = document.getElementById('screenspec-canvas');
        const ctx = canvas.getContext('2d');

        this.annotations.forEach(annotation => {
            if (annotation.type === 'text') {
                // テキスト注釈を描画
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.font = '14px Arial';
                ctx.fillText(annotation.text, annotation.x, annotation.y);
                
                // ポイントマーカーを描画
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(annotation.x, annotation.y, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    async saveAnnotations() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screenIndex = screens.findIndex(s => s.id === this.currentScreenId);
            
            if (screenIndex !== -1) {
                screens[screenIndex].annotations = this.annotations;
                await chrome.storage.local.set({ screens });
                alert('注釈が保存されました！');
            }
        } catch (error) {
            console.error('注釈保存エラー:', error);
            alert('保存に失敗しました。');
        }
    }

    setupKeyboardEvents() {
        this.keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeAnnotationMode();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    closeAnnotationMode() {
        // オーバーレイを削除
        const overlay = document.getElementById('screenspec-overlay');
        if (overlay) {
            overlay.remove();
        }

        // イベントリスナーを削除
        document.removeEventListener('keydown', this.keyHandler);

        // 状態をリセット
        this.isAnnotationMode = false;
        this.currentScreenId = null;
        this.annotations = [];
    }
}

// Content script初期化
const screenSpecContent = new ScreenSpecContent();