class ScreenSpecPopup {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedScreens();
    }

    bindEvents() {
        // キャプチャボタンのイベント
        document.getElementById('captureVisible').addEventListener('click', () => {
            this.captureScreen('visible');
        });

        document.getElementById('captureFullPage').addEventListener('click', () => {
            this.captureScreen('fullPage');
        });

        // 書き出しボタンのイベント
        document.getElementById('exportPDF').addEventListener('click', () => {
            this.exportToPDF();
        });

        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportToJSON();
        });
    }

    async captureScreen(type) {
        try {
            const button = document.getElementById(type === 'visible' ? 'captureVisible' : 'captureFullPage');
            button.classList.add('loading');
            button.disabled = true;

            // Chrome APIを使用してキャプチャ
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (type === 'visible') {
                // 表示部分のキャプチャ
                const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
                await this.processCapture(dataUrl, tab);
            } else {
                // ページ全体のキャプチャ（content scriptに依頼）
                chrome.tabs.sendMessage(tab.id, { action: 'captureFullPage' });
            }

        } catch (error) {
            console.error('キャプチャエラー:', error);
            alert('キャプチャに失敗しました。ページを再読み込みして再試行してください。');
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
                description: ''
            }
        };

        // ローカルストレージに保存
        await this.saveScreen(screenData);
        
        // UI更新
        this.loadSavedScreens();
        
        // 注釈モードを開始するかユーザーに確認
        if (confirm('キャプチャが完了しました。注釈を追加しますか？')) {
            this.openAnnotationMode(screenData.id);
        }
    }

    async saveScreen(screenData) {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            screens.push(screenData);
            await chrome.storage.local.set({ screens });
        } catch (error) {
            console.error('保存エラー:', error);
        }
    }

    async loadSavedScreens() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const container = document.getElementById('savedScreens');
            
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
        } catch (error) {
            console.error('読み込みエラー:', error);
        }
    }

    createScreenItem(screen) {
        const item = document.createElement('div');
        item.className = 'screen-item';
        item.innerHTML = `
            <div class="screen-info">
                <div class="screen-name">${screen.metadata.screenName || screen.title || 'Untitled'}</div>
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
        
        editBtn.addEventListener('click', () => {
            this.editScreen(screen.id);
        });
        
        deleteBtn.addEventListener('click', () => {
            this.deleteScreen(screen.id);
        });
        
        return item;
    }

    async editScreen(screenId) {
        try {
            // アクティブなタブを取得
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 保存済み画面データを取得
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screen = screens.find(s => s.id === screenId);
            
            if (!screen) {
                alert('画面データが見つかりません');
                return;
            }
            
            // 高度な注釈機能を直接注入
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (screenData) => {
                    // 高度な注釈モードを実装
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
                        tempAnnotation: null
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
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        
                        .tool-btn:hover {
                            background: #f8f9fa;
                            transform: translateY(-1px);
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        }
                        
                        .tool-btn.active {
                            background: #007bff;
                            border-color: #007bff;
                            color: white;
                            transform: scale(1.05);
                        }
                        
                        .action-btn {
                            padding: 8px 12px;
                            border: 1px solid #ddd;
                            background: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                            transition: all 0.2s ease;
                            min-width: 44px;
                        }
                        
                        .action-btn:hover {
                            background: #f8f9fa;
                            transform: translateY(-1px);
                        }
                    `;

                    document.head.appendChild(style);
                    document.body.appendChild(overlay);

                    // キャンバスの初期化
                    const canvas = document.getElementById('annotation-canvas');
                    const ctx = canvas.getContext('2d');
                    let originalImage = null; // 画像をキャッシュ
                    
                    // 元画像を読み込んでキャンバスに描画
                    const img = new Image();
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        originalImage = img; // 画像をキャッシュ
                        ctx.drawImage(img, 0, 0);
                        
                        // 既存の注釈を描画
                        redrawAnnotations();
                    };
                    img.src = screenData.dataUrl;

                    // 注釈描画関数（フラッシュバック修正版）
                    function redrawAnnotations() {
                        if (!originalImage) return;
                        
                        // 元画像を即座に再描画（非同期なし）
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(originalImage, 0, 0);
                        
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
                                
                                // ポイントマーカー
                                ctx.beginPath();
                                ctx.arc(annotation.x, annotation.y, 4, 0, 2 * Math.PI);
                                ctx.fill();
                                break;
                                
                            case 'arrow':
                                const { startX, startY, endX, endY } = annotation;
                                
                                // 矢印の線
                                ctx.beginPath();
                                ctx.moveTo(startX, startY);
                                ctx.lineTo(endX, endY);
                                ctx.stroke();
                                
                                // 矢印の頭
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

                    // イベントリスナーの設定
                    
                    // ツール選択
                    document.querySelectorAll('.tool-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                            e.target.classList.add('active');
                            annotationState.currentTool = e.target.id.replace('tool-', '');
                            updateCanvasCursor();
                        });
                    });

                    // 色とサイズの変更
                    document.getElementById('color-picker').addEventListener('change', (e) => {
                        annotationState.currentColor = e.target.value;
                    });

                    document.getElementById('size-selector').addEventListener('change', (e) => {
                        annotationState.currentSize = parseInt(e.target.value);
                    });

                    // アクションボタン
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
                        // 注釈を保存（Chrome storage APIを使用）
                        try {
                            const response = await chrome.runtime.sendMessage({
                                action: 'saveAnnotations',
                                screenId: screenData.id,
                                annotations: annotationState.annotations
                            });
                            alert('注釈が保存されました！');
                        } catch (error) {
                            console.error('保存エラー:', error);
                            alert('保存に失敗しました');
                        }
                    });

                    document.getElementById('close-btn').addEventListener('click', () => {
                        overlay.remove();
                    });

                    // キャンバスマウスイベント（パフォーマンス改善版）
                    let isMouseDown = false;
                    let rafId = null; // RequestAnimationFrame ID

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
                        if (rafId) return; // 既にリクエスト済みの場合はスキップ
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
                        
                        // フレームレート制限付きで再描画
                        throttledRedraw();
                    });

                    canvas.addEventListener('mouseup', (e) => {
                        if (!isMouseDown || !annotationState.isDrawing || annotationState.currentTool === 'text') return;
                        
                        isMouseDown = false;
                        const pos = getMousePos(e);
                        annotationState.tempAnnotation.endX = pos.x;
                        annotationState.tempAnnotation.endY = pos.y;
                        
                        // 注釈を確定
                        annotationState.annotations.push({
                            ...annotationState.tempAnnotation,
                            id: Date.now().toString(),
                            timestamp: new Date().toISOString()
                        });
                        
                        annotationState.isDrawing = false;
                        annotationState.tempAnnotation = null;
                        redrawAnnotations();
                    });

                    // マウスがキャンバスから離れた時の処理
                    canvas.addEventListener('mouseleave', () => {
                        if (isMouseDown && annotationState.isDrawing) {
                            // 描画を中断
                            isMouseDown = false;
                            annotationState.isDrawing = false;
                            annotationState.tempAnnotation = null;
                            redrawAnnotations();
                        }
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

                    console.log('✅ Advanced annotation mode loaded successfully!');
                },
                args: [screen]
            });
            
            window.close(); // ポップアップを閉じる
            
        } catch (error) {
            console.error('高度な注釈モード開始エラー:', error);
            alert('注釈機能の開始に失敗しました。エラー: ' + error.message);
        }
    }

    async deleteScreen(screenId) {
        if (!confirm('この画面を削除しますか？')) return;

        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const updatedScreens = screens.filter(screen => screen.id !== screenId);
            await chrome.storage.local.set({ screens: updatedScreens });
            this.loadSavedScreens();
        } catch (error) {
            console.error('削除エラー:', error);
        }
    }

    openAnnotationMode(screenId) {
        // content scriptに注釈モード開始を通知
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'startAnnotation',
                screenId: screenId
            });
        });
    }

    updateExportButtons(enabled) {
        document.getElementById('exportPDF').disabled = !enabled;
        document.getElementById('exportJSON').disabled = !enabled;
    }

    async exportToPDF() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            if (screens.length === 0) return;

            // バックグラウンドスクリプトにPDF生成を依頼
            chrome.runtime.sendMessage({
                action: 'exportPDF',
                screens: screens
            });
            
            alert('PDF生成を開始しました。完了までお待ちください。');
        } catch (error) {
            console.error('PDF書き出しエラー:', error);
            alert('PDF書き出しに失敗しました。');
        }
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
            console.error('JSON書き出しエラー:', error);
            alert('データ書き出しに失敗しました。');
        }
    }
}

// ポップアップ初期化
const screenSpecPopup = new ScreenSpecPopup();

// メッセージリスナー（content scriptからの通信用）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureComplete') {
        screenSpecPopup.processCapture(message.dataUrl, message.tab);
    }
});