class ScreenSpecPopup {
    constructor() {
        console.log('🚀 ScreenSpecPopup initializing...');
        this.init();
    }

    init() {
        console.log('📋 Binding events...');
        this.bindEvents();
        this.loadSavedScreens();
    }

    bindEvents() {
        // キャプチャボタンのイベント
        const captureVisibleBtn = document.getElementById('captureVisible');
        const captureFullPageBtn = document.getElementById('captureFullPage');
        
        if (captureVisibleBtn) {
            captureVisibleBtn.addEventListener('click', () => {
                console.log('📸 Capture visible clicked');
                this.captureScreen('visible');
            });
        }

        if (captureFullPageBtn) {
            captureFullPageBtn.addEventListener('click', () => {
                console.log('📸 Capture full page clicked');
                this.captureScreen('fullPage');
            });
        }

        // 書き出しボタンのイベント
        const exportPDFBtn = document.getElementById('exportPDF');
        const exportJSONBtn = document.getElementById('exportJSON');
        
        if (exportPDFBtn) {
            exportPDFBtn.addEventListener('click', () => {
                console.log('📄 Export PDF clicked');
                this.exportToPDF();
            });
        }

        if (exportJSONBtn) {
            exportJSONBtn.addEventListener('click', () => {
                console.log('💾 Export JSON clicked');
                this.exportToJSON();
            });
        }
    }

    async captureScreen(type) {
        try {
            console.log('📸 Starting capture:', type);
            
            const button = document.getElementById(type === 'visible' ? 'captureVisible' : 'captureFullPage');
            if (button) {
                button.classList.add('loading');
                button.disabled = true;
            }

            // Chrome APIを使用してキャプチャ
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('🎯 Active tab:', tab.url);
            
            if (type === 'visible') {
                // 表示部分のキャプチャ
                const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
                await this.processCapture(dataUrl, tab);
            } else {
                // ページ全体のキャプチャ（将来実装）
                alert('ページ全体キャプチャは次のバージョンで実装予定です');
            }

        } catch (error) {
            console.error('❌ キャプチャエラー:', error);
            alert('キャプチャに失敗しました: ' + error.message);
        } finally {
            // ボタンの状態をリセット
            setTimeout(() => {
                const buttons = document.querySelectorAll('.btn');
                buttons.forEach(btn => {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                });
            }, 500);
        }
    }

    async processCapture(dataUrl, tab) {
        console.log('💾 Processing capture...');
        
        // キャプチャデータを処理
        const screenData = {
            id: Date.now().toString(),
            dataUrl: dataUrl,
            url: tab.url,
            title: tab.title,
            timestamp: new Date().toISOString(),
            annotations: [],
            metadata: {
                screenName: '',
                functionName: '',
                author: '',
                description: '',
                tags: ''
            }
        };

        // ローカルストレージに保存
        await this.saveScreen(screenData);
        
        // UI更新
        this.loadSavedScreens();
        
        console.log('✅ Capture processed successfully');
        alert('📸 キャプチャが完了しました！編集ボタンから注釈を追加できます。');
    }

    async saveScreen(screenData) {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            screens.push(screenData);
            await chrome.storage.local.set({ screens });
            console.log('💾 Screen saved:', screenData.id);
        } catch (error) {
            console.error('❌ 保存エラー:', error);
        }
    }

    async loadSavedScreens() {
        try {
            console.log('📂 Loading saved screens...');
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const container = document.getElementById('savedScreens');
            
            if (!container) {
                console.error('❌ savedScreens container not found');
                return;
            }
            
            if (screens.length === 0) {
                container.innerHTML = '保存された画面がありません<br><small>キャプチャボタンで画面を保存しましょう</small>';
                this.updateExportButtons(false);
                return;
            }

            container.innerHTML = '';
            screens.reverse().slice(0, 5).forEach(screen => {
                const item = this.createScreenItem(screen);
                container.appendChild(item);
            });

            this.updateExportButtons(true);
            console.log('✅ Loaded', screens.length, 'screens');
        } catch (error) {
            console.error('❌ 読み込みエラー:', error);
        }
    }

    createScreenItem(screen) {
        const item = document.createElement('div');
        item.className = 'screen-item';
        
        const displayName = screen.metadata?.screenName || screen.title || 'Untitled';
        
        item.innerHTML = `
            <div class="screen-info">
                <div class="screen-name">${displayName}</div>
                <div class="screen-time">${new Date(screen.timestamp).toLocaleString('ja-JP')}</div>
            </div>
            <div class="screen-actions">
                <button class="btn btn-secondary btn-small edit-btn" data-screen-id="${screen.id}">
                    編集
                </button>
                <button class="btn btn-secondary btn-small delete-btn" data-screen-id="${screen.id}">
                    削除
                </button>
            </div>
        `;
        
        // イベントリスナーを追加
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                console.log('✏️ Edit clicked for screen:', screen.id);
                this.editScreen(screen.id);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                console.log('🗑️ Delete clicked for screen:', screen.id);
                this.deleteScreen(screen.id);
            });
        }
        
        return item;
    }

    async editScreen(screenId) {
        try {
            console.log('✏️ Starting advanced edit mode for screen:', screenId);
            
            // アクティブなタブを取得
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 保存済み画面データを取得
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screen = screens.find(s => s.id === screenId);
            
            if (!screen) {
                alert('画面データが見つかりません');
                return;
            }
            
            // 高度な注釈機能を注入（エラー修正版）
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (screenData) => {
                    console.log('🎨 Starting advanced annotation mode');
                    
                    // 既存のオーバーレイを削除
                    const existing = document.getElementById('screenspec-advanced-overlay');
                    if (existing) {
                        existing.remove();
                    }

                    // 注釈状態管理
                    const annotationState = {
                        currentTool: 'text',
                        currentColor: '#ff0000',
                        currentSize: 4,
                        annotations: screenData.annotations || [],
                        isDrawing: false,
                        startPoint: null,
                        tempAnnotation: null,
                        originalImage: null // 画像キャッシュ用
                    };

                    // 高度な注釈オーバーレイを作成
                    const overlay = document.createElement('div');
                    overlay.id = 'screenspec-advanced-overlay';
                    overlay.innerHTML = `
                        <div style="
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: rgba(0, 0, 0, 0.9);
                            z-index: 999999;
                            display: flex;
                            flex-direction: column;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">
                            <!-- ツールバー -->
                            <div id="annotation-toolbar" style="
                                background: white;
                                padding: 12px 16px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                                gap: 16px;
                            ">
                                <!-- ツール選択 -->
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <span style="font-weight: 600; color: #333; margin-right: 8px;">ツール:</span>
                                    <button id="tool-text" class="tool-btn active" title="テキスト注釈">📝</button>
                                    <button id="tool-arrow" class="tool-btn" title="矢印">➡️</button>
                                    <button id="tool-box" class="tool-btn" title="枠線">⬜</button>
                                    <button id="tool-highlight" class="tool-btn" title="ハイライト">🖍️</button>
                                    <button id="tool-circle" class="tool-btn" title="円形">⭕</button>
                                </div>
                                
                                <!-- 色とサイズ -->
                                <div style="display: flex; gap: 12px; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-size: 14px; color: #666;">色:</span>
                                        <input type="color" id="color-picker" value="#ff0000" style="
                                            width: 40px;
                                            height: 32px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            cursor: pointer;
                                            padding: 0;
                                        ">
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-size: 14px; color: #666;">太さ:</span>
                                        <select id="size-selector" style="
                                            padding: 6px 8px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            background: white;
                                            cursor: pointer;
                                        ">
                                            <option value="2">細い (2px)</option>
                                            <option value="4" selected>普通 (4px)</option>
                                            <option value="6">太い (6px)</option>
                                            <option value="8">極太 (8px)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- アクション -->
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button id="info-btn" style="
                                        background: #17a2b8;
                                        color: white;
                                        border: none;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-weight: 500;
                                        font-size: 14px;
                                    ">📋 情報</button>
                                    <button id="undo-btn" class="action-btn" title="元に戻す">↶</button>
                                    <button id="clear-btn" class="action-btn" title="全消去">🗑️</button>
                                    <button id="save-btn" style="
                                        background: #28a745;
                                        color: white;
                                        border: none;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-weight: 500;
                                        font-size: 14px;
                                    ">💾 保存</button>
                                    <button id="close-btn" style="
                                        background: #dc3545;
                                        color: white;
                                        border: none;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-weight: 500;
                                        font-size: 14px;
                                    ">✕ 閉じる</button>
                                </div>
                            </div>
                            
                            <!-- メタ情報パネル -->
                            <div id="metadata-panel" style="
                                background: #f8f9fa;
                                border-bottom: 1px solid #e9ecef;
                                padding: 16px;
                                display: none;
                                max-height: 250px;
                                overflow-y: auto;
                            ">
                                <div style="
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 16px;
                                    max-width: 800px;
                                    margin: 0 auto;
                                ">
                                    <div>
                                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">📋 画面名</label>
                                        <input type="text" id="screen-name" placeholder="例: ログイン画面" style="
                                            width: 100%;
                                            padding: 8px 12px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            box-sizing: border-box;
                                        ">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">⚙️ 機能名</label>
                                        <input type="text" id="function-name" placeholder="例: ユーザー認証" style="
                                            width: 100%;
                                            padding: 8px 12px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            box-sizing: border-box;
                                        ">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">👤 作成者</label>
                                        <input type="text" id="author-name" placeholder="例: 田中太郎" style="
                                            width: 100%;
                                            padding: 8px 12px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            box-sizing: border-box;
                                        ">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">🏷️ タグ</label>
                                        <input type="text" id="tags" placeholder="例: 認証, フロント" style="
                                            width: 100%;
                                            padding: 8px 12px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            box-sizing: border-box;
                                        ">
                                    </div>
                                    <div style="grid-column: 1 / -1;">
                                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #333;">📝 説明</label>
                                        <textarea id="description" placeholder="画面の詳細説明..." style="
                                            width: 100%;
                                            padding: 8px 12px;
                                            border: 1px solid #ddd;
                                            border-radius: 4px;
                                            font-size: 14px;
                                            min-height: 60px;
                                            resize: vertical;
                                            box-sizing: border-box;
                                            font-family: inherit;
                                        "></textarea>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- キャンバスエリア -->
                            <div style="
                                flex: 1;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                padding: 20px;
                                overflow: auto;
                            ">
                                <canvas id="annotation-canvas" style="
                                    max-width: 90%;
                                    max-height: 90%;
                                    border: 2px solid white;
                                    border-radius: 8px;
                                    cursor: crosshair;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                                "></canvas>
                            </div>
                        </div>
                    `;

                    // スタイルを追加
                    const style = document.createElement('style');
                    style.textContent = `
                        .tool-btn {
                            padding: 8px 12px;
                            border: 2px solid #ddd;
                            background: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                            transition: all 0.2s ease;
                            min-width: 44px;
                        }
                        
                        .tool-btn:hover {
                            background: #f8f9fa;
                            transform: translateY(-1px);
                        }
                        
                        .tool-btn.active {
                            background: #007bff;
                            border-color: #007bff;
                            color: white;
                        }
                        
                        .action-btn {
                            padding: 8px 12px;
                            border: 1px solid #ddd;
                            background: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                        }
                    `;

                    document.head.appendChild(style);
                    document.body.appendChild(overlay);

                    // キャンバスの初期化
                    const canvas = document.getElementById('annotation-canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 元画像を読み込んでキャンバスに描画
                    const img = new Image();
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        annotationState.originalImage = img; // 画像をキャッシュ
                        ctx.drawImage(img, 0, 0);
                        
                        // 既存の注釈を描画
                        redrawAnnotations();
                        
                        // メタ情報を初期化
                        initializeMetadata();
                    };
                    img.src = screenData.dataUrl;

                    // 注釈描画関数（フラッシュバック修正版）
                    function redrawAnnotations() {
                        if (!annotationState.originalImage) return;
                        
                        // 元画像を即座に再描画
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(annotationState.originalImage, 0, 0);
                        
                        // 注釈を描画
                        annotationState.annotations.forEach(annotation => {
                            drawAnnotation(annotation);
                        });
                        
                        // 一時的な注釈を描画（プレビュー）
                        if (annotationState.tempAnnotation) {
                            drawAnnotation(annotationState.tempAnnotation, true);
                        }
                    }

                    // 注釈描画関数
                    function drawAnnotation(annotation, isPreview = false) {
                        ctx.save();
                        
                        ctx.globalAlpha = isPreview ? 0.7 : 1.0;
                        ctx.strokeStyle = annotation.color;
                        ctx.fillStyle = annotation.color;
                        ctx.lineWidth = annotation.size || 4;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';

                        switch (annotation.type) {
                            case 'text':
                                ctx.font = `${(annotation.size || 4) + 10}px Arial`;
                                ctx.fillText(annotation.text, annotation.x, annotation.y);
                                ctx.beginPath();
                                ctx.arc(annotation.x, annotation.y, 4, 0, 2 * Math.PI);
                                ctx.fill();
                                break;
                                
                            case 'arrow':
                                const { startX, startY, endX, endY } = annotation;
                                ctx.beginPath();
                                ctx.moveTo(startX, startY);
                                ctx.lineTo(endX, endY);
                                ctx.stroke();
                                
                                const angle = Math.atan2(endY - startY, endX - startX);
                                const headLength = 20;
                                ctx.beginPath();
                                ctx.moveTo(endX, endY);
                                ctx.lineTo(
                                    endX - headLength * Math.cos(angle - Math.PI / 6),
                                    endY - headLength * Math.sin(angle - Math.PI / 6)
                                );
                                ctx.lineTo(
                                    endX - headLength * Math.cos(angle + Math.PI / 6),
                                    endY - headLength * Math.sin(angle + Math.PI / 6)
                                );
                                ctx.lineTo(endX, endY);
                                ctx.fillStyle = annotation.color;
                                ctx.fill();
                                break;
                                
                            case 'box':
                                const width = annotation.endX - annotation.startX;
                                const height = annotation.endY - annotation.startY;
                                ctx.beginPath();
                                ctx.rect(annotation.startX, annotation.startY, width, height);
                                ctx.stroke();
                                break;
                                
                            case 'highlight':
                                const hlWidth = annotation.endX - annotation.startX;
                                const hlHeight = annotation.endY - annotation.startY;
                                ctx.globalAlpha = 0.3;
                                ctx.fillRect(annotation.startX, annotation.startY, hlWidth, hlHeight);
                                break;
                                
                            case 'circle':
                                const radius = Math.sqrt(
                                    Math.pow(annotation.endX - annotation.startX, 2) + 
                                    Math.pow(annotation.endY - annotation.startY, 2)
                                );
                                ctx.beginPath();
                                ctx.arc(annotation.startX, annotation.startY, radius, 0, 2 * Math.PI);
                                ctx.stroke();
                                break;
                        }
                        
                        ctx.restore();
                    }

                    // メタ情報の初期化
                    function initializeMetadata() {
                        const metadata = screenData.metadata || {};
                        document.getElementById('screen-name').value = metadata.screenName || '';
                        document.getElementById('function-name').value = metadata.functionName || '';
                        document.getElementById('author-name').value = metadata.author || '';
                        document.getElementById('tags').value = metadata.tags || '';
                        document.getElementById('description').value = metadata.description || '';
                    }

                    // イベントリスナーの設定
                    document.querySelectorAll('.tool-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                            e.target.classList.add('active');
                            annotationState.currentTool = e.target.id.replace('tool-', '');
                            updateCanvasCursor();
                        });
                    });

                    document.getElementById('color-picker').addEventListener('change', (e) => {
                        annotationState.currentColor = e.target.value;
                    });

                    document.getElementById('size-selector').addEventListener('change', (e) => {
                        annotationState.currentSize = parseInt(e.target.value);
                    });

                    document.getElementById('info-btn').addEventListener('click', () => {
                        const panel = document.getElementById('metadata-panel');
                        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    });

                    document.getElementById('undo-btn').addEventListener('click', () => {
                        if (annotationState.annotations.length > 0) {
                            annotationState.annotations.pop();
                            redrawAnnotations();
                        }
                    });

                    document.getElementById('clear-btn').addEventListener('click', () => {
                        if (confirm('すべての注釈を削除しますか？')) {
                            annotationState.annotations = [];
                            redrawAnnotations();
                        }
                    });

                    document.getElementById('save-btn').addEventListener('click', async () => {
                        try {
                            const metadata = {
                                screenName: document.getElementById('screen-name').value,
                                functionName: document.getElementById('function-name').value,
                                author: document.getElementById('author-name').value,
                                tags: document.getElementById('tags').value,
                                description: document.getElementById('description').value,
                                updatedDate: new Date().toISOString()
                            };

                            const response = await chrome.runtime.sendMessage({
                                action: 'saveAnnotations',
                                screenId: screenData.id,
                                annotations: annotationState.annotations,
                                metadata: metadata
                            });
                            
                            alert('💾 注釈とメタ情報が保存されました！');
                        } catch (error) {
                            console.error('保存エラー:', error);
                            alert('保存に失敗しました');
                        }
                    });

                    document.getElementById('close-btn').addEventListener('click', () => {
                        overlay.remove();
                    });

                    // キャンバスマウスイベント
                    let isMouseDown = false;
                    let rafId = null;

                    function getMousePos(e) {
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        return {
                            x: (e.clientX - rect.left) * scaleX,
                            y: (e.clientY - rect.top) * scaleY
                        };
                    }

                    function throttledRedraw() {
                        if (rafId) return;
                        rafId = requestAnimationFrame(() => {
                            redrawAnnotations();
                            rafId = null;
                        });
                    }

                    canvas.addEventListener('mousedown', (e) => {
                        if (annotationState.currentTool === 'text') return;
                        
                        const pos = getMousePos(e);
                        isMouseDown = true;
                        annotationState.isDrawing = true;
                        annotationState.startPoint = pos;
                        
                        annotationState.tempAnnotation = {
                            type: annotationState.currentTool,
                            color: annotationState.currentColor,
                            size: annotationState.currentSize,
                            startX: pos.x,
                            startY: pos.y,
                            endX: pos.x,
                            endY: pos.y
                        };
                    });

                    canvas.addEventListener('mousemove', (e) => {
                        if (!isMouseDown || !annotationState.isDrawing || annotationState.currentTool === 'text') return;
                        
                        const pos = getMousePos(e);
                        annotationState.tempAnnotation.endX = pos.x;
                        annotationState.tempAnnotation.endY = pos.y;
                        
                        throttledRedraw();
                    });

                    canvas.addEventListener('mouseup', (e) => {
                        if (!isMouseDown || !annotationState.isDrawing || annotationState.currentTool === 'text') return;
                        
                        isMouseDown = false;
                        const pos = getMousePos(e);
                        annotationState.tempAnnotation.endX = pos.x;
                        annotationState.tempAnnotation.endY = pos.y;
                        
                        annotationState.annotations.push({
                            ...annotationState.tempAnnotation,
                            id: Date.now().toString(),
                            timestamp: new Date().toISOString()
                        });
                        
                        annotationState.isDrawing = false;
                        annotationState.tempAnnotation = null;
                        redrawAnnotations();
                    });

                    canvas.addEventListener('click', (e) => {
                        if (annotationState.currentTool !== 'text') return;
                        
                        const pos = getMousePos(e);
                        const text = prompt('注釈テキストを入力してください:');
                        if (!text) return;

                        annotationState.annotations.push({
                            id: Date.now().toString(),
                            type: 'text',
                            x: pos.x,
                            y: pos.y,
                            text: text,
                            color: annotationState.currentColor,
                            size: annotationState.currentSize,
                            timestamp: new Date().toISOString()
                        });

                        redrawAnnotations();
                    });

                    function updateCanvasCursor() {
                        switch (annotationState.currentTool) {
                            case 'text':
                                canvas.style.cursor = 'text';
                                break;
                            case 'arrow':
                            case 'box':
                            case 'circle':
                                canvas.style.cursor = 'crosshair';
                                break;
                            case 'highlight':
                                canvas.style.cursor = 'cell';
                                break;
                            default:
                                canvas.style.cursor = 'default';
                        }
                    }

                    // ESCキーで閉じる
                    const escHandler = (e) => {
                        if (e.key === 'Escape') {
                            overlay.remove();
                            document.removeEventListener('keydown', escHandler);
                        }
                    };
                    document.addEventListener('keydown', escHandler);

                    console.log('✅ Advanced annotation mode with metadata loaded successfully!');
                },
                args: [screen]
            });
            
            window.close(); // ポップアップを閉じる
            
        } catch (error) {
            console.error('❌ 高度な編集モード開始エラー:', error);
            alert('注釈機能の開始に失敗しました: ' + error.message);
        }
    }

    async deleteScreen(screenId) {
        if (!confirm('この画面を削除しますか？')) return;

        try {
            console.log('🗑️ Deleting screen:', screenId);
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const updatedScreens = screens.filter(screen => screen.id !== screenId);
            await chrome.storage.local.set({ screens: updatedScreens });
            this.loadSavedScreens();
            console.log('✅ Screen deleted successfully');
        } catch (error) {
            console.error('❌ 削除エラー:', error);
        }
    }

    updateExportButtons(enabled) {
        const exportPDFBtn = document.getElementById('exportPDF');
        const exportJSONBtn = document.getElementById('exportJSON');
        
        if (exportPDFBtn) exportPDFBtn.disabled = !enabled;
        if (exportJSONBtn) exportJSONBtn.disabled = !enabled;
    }

    async exportToPDF() {
        try {
            console.log('📄 Starting direct HTML export...');
            
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            if (screens.length === 0) {
                alert('書き出す画面がありません。先にキャプチャを行ってください。');
                return;
            }

            // PDF生成の準備
            const button = document.getElementById('exportPDF');
            if (button) {
                button.disabled = true;
                button.textContent = '📄 生成中...';
            }

            console.log('📊 Generating HTML for', screens.length, 'screens');

            // HTML設計書を直接生成
            const htmlContent = this.generateHTMLReport(screens);
            
            // HTMLをダウンロード
            const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            // ダウンロード実行
            const timestamp = new Date().toISOString().split('T')[0];
            const link = document.createElement('a');
            link.href = url;
            link.download = `ScreenSpec設計書_${timestamp}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // URLを解放
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            console.log('✅ HTML export completed successfully');
            
            // 成功メッセージ
            const totalAnnotations = screens.reduce((sum, s) => sum + (s.annotations?.length || 0), 0);
            alert(`📄 HTML設計書の書き出しが完了しました！\n\n📊 統計情報:\n- 総画面数: ${screens.length}画面\n- 総注釈数: ${totalAnnotations}個\n\n💡 使い方:\n1. ダウンロードしたHTMLファイルをブラウザで開く\n2. Ctrl+P → 「PDFに保存」でPDF変換\n3. プロフェッショナルな設計書として利用できます`);

        } catch (error) {
            console.error('❌ HTML書き出しエラー:', error);
            alert('書き出しに失敗しました。\n\nエラー: ' + error.message);
        } finally {
            // ボタンの状態をリセット
            const button = document.getElementById('exportPDF');
            if (button) {
                button.disabled = false;
                button.textContent = 'PDF書き出し';
            }
        }
    }

    generateHTMLReport(screens) {
        const totalAnnotations = screens.reduce((sum, screen) => sum + (screen.annotations?.length || 0), 0);
        const authors = [...new Set(screens.map(s => s.metadata?.author).filter(a => a))];
        const now = new Date();
        
        const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScreenSpec 設計書</title>
    <style>
        body {
            font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', 'Meiryo', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .cover {
            text-align: center;
            border-bottom: 3px solid #667eea;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        .cover h1 {
            font-size: 2.8em;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .cover .stats {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 12px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            text-align: left;
        }
        .stat-item {
            padding: 10px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .toc {
            margin-bottom: 40px;
        }
        .toc h2 {
            color: #667eea;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 15px;
            font-size: 1.8em;
        }
        .toc-item {
            padding: 15px;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s;
            border-radius: 8px;
            margin: 5px 0;
        }
        .toc-item:hover {
            background-color: #f8f9fa;
        }
        .screen-section {
            margin: 40px 0;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .screen-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
        }
        .screen-header h2 {
            margin: 0;
            font-size: 1.5em;
        }
        .screen-content {
            padding: 30px;
        }
        .screen-image {
            max-width: 100%;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .screen-image:hover {
            transform: scale(1.02);
        }
        .metadata {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metadata-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid #667eea;
        }
        .metadata-item strong {
            color: #667eea;
        }
        .tag {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.9em;
            margin-right: 5px;
            display: inline-block;
            margin-bottom: 5px;
        }
        .description-section {
            margin-top: 25px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #e9ecef;
            color: #6c757d;
        }
        @media print {
            body { 
                background: white !important; 
                padding: 0 !important;
            }
            .container { 
                box-shadow: none !important;
                border-radius: 0 !important;
            }
            .screen-section { 
                page-break-inside: avoid; 
                box-shadow: none !important;
            }
            .screen-image:hover {
                transform: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 表紙 -->
        <div class="cover">
            <h1>📋 ScreenSpec 設計書</h1>
            <div class="stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>📅 作成日</strong><br>
                        ${now.toLocaleDateString('ja-JP')}
                    </div>
                    <div class="stat-item">
                        <strong>📊 総画面数</strong><br>
                        ${screens.length}画面
                    </div>
                    <div class="stat-item">
                        <strong>🎨 総注釈数</strong><br>
                        ${totalAnnotations}個
                    </div>
                    ${authors.length > 0 ? `<div class="stat-item">
                        <strong>👤 作成者</strong><br>
                        ${authors.join(', ')}
                    </div>` : ''}
                </div>
            </div>
        </div>

        <!-- 目次 -->
        <div class="toc">
            <h2>📑 目次</h2>
            ${screens.map((screen, index) => {
                const title = screen.metadata?.screenName || screen.title || `画面 ${index + 1}`;
                const functionName = screen.metadata?.functionName || '';
                const annotationCount = screen.annotations?.length || 0;
                return `
                    <div class="toc-item">
                        <strong>${index + 1}. ${title}</strong>
                        ${functionName ? `<br><small style="color: #667eea;">⚙️ ${functionName}</small>` : ''}
                        <br><small style="color: #6c757d;">🎨 ${annotationCount}個の注釈</small>
                    </div>
                `;
            }).join('')}
        </div>

        <!-- 画面詳細 -->
        ${screens.map((screen, index) => {
            const title = screen.metadata?.screenName || screen.title || `画面 ${index + 1}`;
            const metadata = screen.metadata || {};
            const createdDate = new Date(screen.timestamp).toLocaleDateString('ja-JP');
            const modifiedDate = screen.lastModified ? new Date(screen.lastModified).toLocaleDateString('ja-JP') : null;
            const annotationCount = screen.annotations?.length || 0;
            
            return `
                <div class="screen-section">
                    <div class="screen-header">
                        <h2>${index + 1}. ${title}</h2>
                    </div>
                    <div class="screen-content">
                        <div class="metadata">
                            <div class="metadata-grid">
                                ${metadata.functionName ? `<div class="metadata-item"><strong>⚙️ 機能:</strong><br>${metadata.functionName}</div>` : ''}
                                ${metadata.author ? `<div class="metadata-item"><strong>👤 作成者:</strong><br>${metadata.author}</div>` : ''}
                                <div class="metadata-item"><strong>📅 作成日:</strong><br>${createdDate}</div>
                                ${modifiedDate && modifiedDate !== createdDate ? `<div class="metadata-item"><strong>🔄 更新日:</strong><br>${modifiedDate}</div>` : ''}
                                <div class="metadata-item"><strong>🎨 注釈数:</strong><br>${annotationCount}個</div>
                                ${metadata.tags ? `<div class="metadata-item" style="grid-column: 1 / -1;"><strong>🏷️ タグ:</strong><br>${metadata.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}</div>` : ''}
                            </div>
                        </div>
                        
                        ${screen.dataUrl ? `<img src="${screen.dataUrl}" alt="${title}" class="screen-image">` : '<p style="color: #6c757d; text-align: center; padding: 20px;">画像データがありません</p>'}
                        
                        ${metadata.description ? `
                            <div class="description-section">
                                <h4 style="color: #667eea; margin-top: 0;">📝 説明</h4>
                                <p style="white-space: pre-wrap; margin-bottom: 0;">${metadata.description}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('')}

        <!-- フッター -->
        <div class="footer">
            <p><strong>Generated by ScreenSpec v1.0.0</strong></p>
            <p><small>${now.toLocaleString('ja-JP')} に生成</small></p>
            <p><small>📄 ブラウザの印刷機能（Ctrl+P）でPDFに変換できます</small></p>
        </div>
    </div>
</body>
</html>`;
        
        return html;
    }

    async exportToJSON() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            if (screens.length === 0) return;

            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                screens: screens
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `screenspec-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('❌ JSON書き出しエラー:', error);
            alert('データ書き出しに失敗しました。');
        }
    }
}

// ポップアップ初期化
console.log('🚀 Initializing ScreenSpec popup...');
const screenSpecPopup = new ScreenSpecPopup();