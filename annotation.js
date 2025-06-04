/**
 * ScreenSpec - 注釈エディター (PDF機能付き完全版)
 * キャンバス上での高度な注釈機能 + プロフェッショナルPDF出力
 */

class AnnotationEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentTool = 'text';
        this.currentColor = '#ff0000';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.annotations = [];
        this.history = [];
        this.screenData = null;
        this.metaPanelOpen = false;
        this.zoomLevel = 1;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.canvasScale = 1;
        this.initialized = false;
        
        this.init();
    }

    async init() {
        try {
            // キャンバス要素を取得
            this.canvas = document.getElementById('annotationCanvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            if (!this.ctx) {
                throw new Error('Canvas 2D context not available');
            }

            console.log('Canvas initialized successfully');

            await this.loadScreenData();
            this.setupCanvas();
            this.setupEventListeners();
            this.loadMetaInfo();
            
            // PDF機能の初期化
            this.initializePDFFeatures();
            
            this.initialized = true;
            console.log('AnnotationEditor initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('初期化エラー: ' + error.message);
            
            // フォールバック用の空のメソッドを設定
            this.setupFallbackMethods();
        }
    }

    setupFallbackMethods() {
        // エラー時のフォールバック処理
        const fallbackMethods = [
            'selectTool', 'updateCursor', 'handleMouseDown', 'handleMouseMove', 
            'handleMouseUp', 'handleClick', 'saveAnnotations', 'undo', 'zoomIn', 
            'zoomOut', 'fitToWidth', 'fitToScreen', 'actualSize'
        ];
        
        fallbackMethods.forEach(method => {
            if (typeof this[method] === 'function') {
                const originalMethod = this[method];
                this[method] = (...args) => {
                    if (!this.initialized) {
                        console.warn(`Method ${method} called before initialization`);
                        return;
                    }
                    return originalMethod.apply(this, args);
                };
            }
        });
    }

    async loadScreenData() {
        // URLパラメータからscreenIdを取得
        const urlParams = new URLSearchParams(window.location.search);
        const screenId = urlParams.get('screenId');
        
        if (!screenId) {
            throw new Error('Screen ID not found');
        }

        // ストレージから画面データを取得
        const result = await chrome.storage.local.get(['screens']);
        const screens = result.screens || [];
        this.screenData = screens.find(s => s.id === screenId);
        
        if (!this.screenData) {
            throw new Error('Screen data not found');
        }

        console.log('Screen data loaded:', this.screenData);
    }

    setupCanvas() {
        const img = new Image();
        img.onload = () => {
            // 元のサイズを保存
            this.originalWidth = img.width;
            this.originalHeight = img.height;
            
            // 表示領域を計算
            this.calculateCanvasSize();
            
            // 背景画像を描画
            this.drawBackground(img);
            
            // 既存の注釈があれば復元
            this.restoreAnnotations();
            
            console.log('Canvas setup complete');
        };
        img.src = this.screenData.dataUrl;
    }

    calculateCanvasSize() {
        if (!this.canvas || !this.initialized) return;
        
        try {
            const container = document.querySelector('.canvas-container');
            if (!container) {
                console.warn('Canvas container not found');
                return;
            }
            
            const maxWidth = Math.max(container.clientWidth - 40, 800); // 最小800px
            const maxHeight = Math.max(container.clientHeight - 40, 600); // 最小600px
            
            // アスペクト比を維持して最適なサイズを計算
            const widthRatio = maxWidth / this.originalWidth;
            const heightRatio = maxHeight / this.originalHeight;
            
            // 小さすぎる画像は拡大、大きすぎる画像は縮小
            let scale = Math.min(widthRatio, heightRatio);
            
            // 最小50%、最大200%の制限
            scale = Math.max(scale, 0.5);
            scale = Math.min(scale, 2.0);
            
            // 元画像が小さい場合は最低でも80%まで拡大
            if (this.originalWidth < 800 || this.originalHeight < 600) {
                scale = Math.max(scale, 0.8);
            }
            
            this.canvasScale = scale;
            
            console.log(`Canvas sizing: original(${this.originalWidth}x${this.originalHeight}) -> scale(${scale.toFixed(2)})`);
            
            // キャンバスサイズを設定
            this.canvas.width = this.originalWidth;
            this.canvas.height = this.originalHeight;
            
            // 表示サイズを設定
            this.canvas.style.width = (this.originalWidth * this.canvasScale) + 'px';
            this.canvas.style.height = (this.originalHeight * this.canvasScale) + 'px';
            
            this.updateZoomDisplay();
        } catch (error) {
            console.warn('Error calculating canvas size:', error);
        }
    }

    drawBackground(img) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0);
    }

    updateZoomDisplay() {
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            zoomElement.textContent = Math.round(this.canvasScale * 100) + '%';
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // ツールボタンのイベント
        try {
            const toolButtons = document.querySelectorAll('[data-tool]');
            console.log('Found tool buttons:', toolButtons.length);
            
            toolButtons.forEach((btn, index) => {
                if (btn && typeof btn.addEventListener === 'function') {
                    btn.addEventListener('click', (e) => {
                        console.log('Tool button clicked:', e.target.dataset.tool);
                        this.selectTool(e.target.dataset.tool);
                    });
                }
            });
        } catch (error) {
            console.warn('Error setting up tool buttons:', error);
        }

        // 各要素のイベントリスナーを安全に設定
        const setupListener = (elementId, eventType, handler) => {
            try {
                const element = document.getElementById(elementId);
                if (element && typeof element.addEventListener === 'function') {
                    element.addEventListener(eventType, handler);
                    console.log(`Event listener set for ${elementId}`);
                } else {
                    console.warn(`Element not found or invalid: ${elementId}`);
                }
            } catch (error) {
                console.warn(`Error setting up listener for ${elementId}:`, error);
            }
        };

        // カラーピッカー
        setupListener('colorPicker', 'change', (e) => {
            this.currentColor = e.target.value;
        });

        // キャンバスイベント
        if (this.canvas && typeof this.canvas.addEventListener === 'function') {
            try {
                this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
                this.canvas.addEventListener('click', (e) => this.handleClick(e));
                console.log('Canvas event listeners set up');
            } catch (error) {
                console.warn('Error setting up canvas events:', error);
            }
        } else {
            console.warn('Canvas not found or invalid for event listeners');
        }

        // ボタンイベント
        setupListener('undoBtn', 'click', () => this.undo());
        setupListener('saveBtn', 'click', () => this.saveAnnotations());
        setupListener('metaToggle', 'click', () => this.toggleMetaPanel());
        setupListener('saveMetaBtn', 'click', () => this.saveMetaInfo());

        // ズームコントロール
        setupListener('zoomIn', 'click', () => this.zoomIn());
        setupListener('zoomOut', 'click', () => this.zoomOut());
        setupListener('zoom50', 'click', () => this.setZoom(0.5));
        setupListener('zoom100', 'click', () => this.setZoom(1.0));
        setupListener('zoom150', 'click', () => this.setZoom(1.5));
        setupListener('fitWidth', 'click', () => this.fitToWidth());
        setupListener('fitScreen', 'click', () => this.fitToScreen());

        // PDF出力ボタン
        setupListener('exportPdfBtn', 'click', () => this.generateCurrentScreenPDF());
        setupListener('exportProjectPdfBtn', 'click', () => this.generateProjectReport());

        // グローバルイベント
        try {
            if (document && typeof document.addEventListener === 'function') {
                document.addEventListener('keydown', (e) => this.handleKeyDown(e));
                console.log('Document keydown listener set');
            }
        } catch (error) {
            console.warn('Error setting up document events:', error);
        }

        try {
            if (window && typeof window.addEventListener === 'function') {
                window.addEventListener('resize', () => this.handleResize());
                console.log('Window resize listener set');
            }
        } catch (error) {
            console.warn('Error setting up window events:', error);
        }

        console.log('Event listeners setup completed');
    }

    selectTool(tool) {
        if (!this.initialized) return;
        
        this.currentTool = tool;
        
        // ボタンの状態を更新
        try {
            document.querySelectorAll('[data-tool]').forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            
            const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        } catch (error) {
            console.warn('Error updating tool buttons:', error);
        }
        
        // カーソルを変更
        this.updateCursor();
        
        console.log('Tool selected:', tool);
    }

    updateCursor() {
        if (!this.canvas || !this.initialized) return;
        
        const cursors = {
            text: 'text',
            arrow: 'crosshair',
            rect: 'crosshair',
            highlight: 'crosshair',
            circle: 'crosshair'
        };
        
        try {
            this.canvas.style.cursor = cursors[this.currentTool] || 'default';
        } catch (error) {
            console.warn('Error updating cursor:', error);
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleMouseDown(e) {
        if (this.currentTool === 'text') return;
        
        const pos = this.getMousePos(e);
        this.isDrawing = true;
        this.startX = pos.x;
        this.startY = pos.y;
        
        // 履歴を保存
        this.saveState();
    }

    handleMouseMove(e) {
        if (!this.isDrawing || this.currentTool === 'text') return;
        
        const pos = this.getMousePos(e);
        
        // 一時的な描画をクリア
        this.restoreState();
        
        // プレビューを描画
        this.drawPreview(this.startX, this.startY, pos.x, pos.y);
    }

    handleMouseUp(e) {
        if (!this.isDrawing || this.currentTool === 'text') return;
        
        const pos = this.getMousePos(e);
        this.isDrawing = false;
        
        // 最終的な図形を描画
        this.drawShape(this.startX, this.startY, pos.x, pos.y);
        
        // 注釈データを保存
        this.addAnnotation({
            type: this.currentTool,
            startX: this.startX,
            startY: this.startY,
            endX: pos.x,
            endY: pos.y,
            color: this.currentColor,
            timestamp: new Date().toISOString()
        });
    }

    handleClick(e) {
        if (this.currentTool !== 'text') return;
        
        const pos = this.getMousePos(e);
        this.addTextAnnotation(pos.x, pos.y);
    }

    drawPreview(startX, startY, endX, endY) {
        this.ctx.save();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.7;
        
        switch (this.currentTool) {
            case 'arrow':
                this.drawArrow(startX, startY, endX, endY);
                break;
            case 'rect':
                this.ctx.strokeRect(startX, startY, endX - startX, endY - startY);
                break;
            case 'highlight':
                this.ctx.globalAlpha = 0.3;
                this.ctx.fillStyle = this.currentColor;
                this.ctx.fillRect(startX, startY, endX - startX, endY - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                this.ctx.beginPath();
                this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
        }
        
        this.ctx.restore();
    }

    drawShape(startX, startY, endX, endY) {
        this.ctx.save();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        
        switch (this.currentTool) {
            case 'arrow':
                this.drawArrow(startX, startY, endX, endY);
                break;
            case 'rect':
                this.ctx.strokeRect(startX, startY, endX - startX, endY - startY);
                break;
            case 'highlight':
                this.ctx.globalAlpha = 0.3;
                this.ctx.fillStyle = this.currentColor;
                this.ctx.fillRect(startX, startY, endX - startX, endY - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                this.ctx.beginPath();
                this.ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
        }
        
        this.ctx.restore();
    }

    drawArrow(startX, startY, endX, endY) {
        const headLength = 15;
        const angle = Math.atan2(endY - startY, endX - startX);
        
        // 線を描画
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // 矢印の頭を描画
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    addTextAnnotation(x, y) {
        const text = prompt('テキストを入力してください:');
        if (!text) return;
        
        this.saveState();
        
        // テキストを描画
        this.ctx.save();
        this.ctx.fillStyle = this.currentColor;
        this.ctx.font = '16px Arial';
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
        
        // 注釈データを保存
        this.addAnnotation({
            type: 'text',
            x: x,
            y: y,
            text: text,
            color: this.currentColor,
            timestamp: new Date().toISOString()
        });
    }

    addAnnotation(annotation) {
        this.annotations.push(annotation);
        console.log('Annotation added:', annotation);
    }

    saveState() {
        this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
        // 履歴は最大20件まで
        if (this.history.length > 20) {
            this.history.shift();
        }
    }

    restoreState() {
        if (this.history.length > 0) {
            const imageData = this.history[this.history.length - 1];
            this.ctx.putImageData(imageData, 0, 0);
        }
    }

    undo() {
        if (this.history.length > 0) {
            this.history.pop(); // 現在の状態を削除
            if (this.history.length > 0) {
                const imageData = this.history[this.history.length - 1];
                this.ctx.putImageData(imageData, 0, 0);
            } else {
                // 履歴がない場合は元の画像に戻す
                this.setupCanvas();
            }
            
            // 対応する注釈も削除
            if (this.annotations.length > 0) {
                this.annotations.pop();
            }
        }
    }

    restoreAnnotations() {
        if (this.screenData.annotations) {
            this.annotations = [...this.screenData.annotations];
            
            // 注釈を再描画
            this.annotations.forEach(annotation => {
                this.redrawAnnotation(annotation);
            });
        }
    }

    redrawAnnotation(annotation) {
        this.ctx.save();
        
        if (annotation.type === 'text') {
            this.ctx.fillStyle = annotation.color;
            this.ctx.font = '16px Arial';
            this.ctx.fillText(annotation.text, annotation.x, annotation.y);
        } else {
            this.ctx.strokeStyle = annotation.color;
            this.ctx.lineWidth = 2;
            
            switch (annotation.type) {
                case 'arrow':
                    this.drawArrow(annotation.startX, annotation.startY, annotation.endX, annotation.endY);
                    break;
                case 'rect':
                    this.ctx.strokeRect(annotation.startX, annotation.startY, 
                        annotation.endX - annotation.startX, annotation.endY - annotation.startY);
                    break;
                case 'highlight':
                    this.ctx.globalAlpha = 0.3;
                    this.ctx.fillStyle = annotation.color;
                    this.ctx.fillRect(annotation.startX, annotation.startY, 
                        annotation.endX - annotation.startX, annotation.endY - annotation.startY);
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(annotation.endX - annotation.startX, 2) + 
                        Math.pow(annotation.endY - annotation.startY, 2));
                    this.ctx.beginPath();
                    this.ctx.arc(annotation.startX, annotation.startY, radius, 0, 2 * Math.PI);
                    this.ctx.stroke();
                    break;
            }
        }
        
        this.ctx.restore();
    }

    async saveAnnotations() {
        try {
            // キャンバスを画像データとして保存
            const annotatedDataUrl = this.canvas.toDataURL('image/png', 0.9);
            
            // ストレージからデータを取得
            const result = await chrome.storage.local.get(['screens']);
            const screens = result.screens || [];
            
            // 該当の画面データを更新
            const screenIndex = screens.findIndex(s => s.id === this.screenData.id);
            if (screenIndex >= 0) {
                screens[screenIndex].dataUrl = annotatedDataUrl;
                screens[screenIndex].annotations = this.annotations;
                screens[screenIndex].updatedAt = new Date().toISOString();
                
                // ストレージに保存
                await chrome.storage.local.set({ screens });
                
                this.showSuccess('注釈を保存しました');
                console.log('Annotations saved successfully');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.showError('保存に失敗しました');
        }
    }

    loadMetaInfo() {
        if (this.screenData.meta) {
            const elements = {
                screenTitle: document.getElementById('screenTitle'),
                functionName: document.getElementById('functionName'),
                createdBy: document.getElementById('createdBy'),
                tags: document.getElementById('tags'),
                description: document.getElementById('description')
            };

            if (elements.screenTitle) elements.screenTitle.value = this.screenData.meta.title || '';
            if (elements.functionName) elements.functionName.value = this.screenData.meta.functionName || '';
            if (elements.createdBy) elements.createdBy.value = this.screenData.meta.createdBy || '';
            if (elements.tags) elements.tags.value = this.screenData.meta.tags || '';
            if (elements.description) elements.description.value = this.screenData.meta.description || '';
        }
    }

    async saveMetaInfo() {
        try {
            const elements = {
                screenTitle: document.getElementById('screenTitle'),
                functionName: document.getElementById('functionName'),
                createdBy: document.getElementById('createdBy'),
                tags: document.getElementById('tags'),
                description: document.getElementById('description')
            };

            const metaInfo = {
                title: elements.screenTitle?.value || '',
                functionName: elements.functionName?.value || '',
                createdBy: elements.createdBy?.value || '',
                tags: elements.tags?.value || '',
                description: elements.description?.value || '',
                updatedAt: new Date().toISOString()
            };
            
            // ストレージからデータを取得
            const result = await chrome.storage.local.get(['screens']);
            const screens = result.screens || [];
            
            // 該当の画面データを更新
            const screenIndex = screens.findIndex(s => s.id === this.screenData.id);
            if (screenIndex >= 0) {
                screens[screenIndex].meta = metaInfo;
                screens[screenIndex].title = metaInfo.title || screens[screenIndex].title;
                
                // ストレージに保存
                await chrome.storage.local.set({ screens });
                
                this.showSuccess('画面情報を保存しました');
                console.log('Meta info saved successfully');
            }
        } catch (error) {
            console.error('Meta save error:', error);
            this.showError('画面情報の保存に失敗しました');
        }
    }

    toggleMetaPanel() {
        this.metaPanelOpen = !this.metaPanelOpen;
        const panel = document.getElementById('metaPanel');
        
        if (this.metaPanelOpen) {
            panel.classList.add('open');
        } else {
            panel.classList.remove('open');
        }
    }

    zoomIn() {
        this.canvasScale = Math.min(this.canvasScale * 1.2, 3); // 最大300%
        this.applyZoom();
    }

    zoomOut() {
        this.canvasScale = Math.max(this.canvasScale / 1.2, 0.1); // 最小10%
        this.applyZoom();
    }

    fitToWidth() {
        const container = document.querySelector('.canvas-container');
        const maxWidth = container.clientWidth - 40;
        this.canvasScale = maxWidth / this.originalWidth;
        this.applyZoom();
    }

    fitToScreen() {
        const container = document.querySelector('.canvas-container');
        const maxWidth = container.clientWidth - 40;
        const maxHeight = container.clientHeight - 40;
        
        const widthRatio = maxWidth / this.originalWidth;
        const heightRatio = maxHeight / this.originalHeight;
        this.canvasScale = Math.min(widthRatio, heightRatio);
        this.applyZoom();
    }

    actualSize() {
        this.canvasScale = 1;
        this.applyZoom();
    }

    setZoom(scale) {
        this.canvasScale = scale;
        this.applyZoom();
    }

    applyZoom() {
        if (!this.canvas || !this.initialized) return;
        
        try {
            this.canvas.style.width = (this.originalWidth * this.canvasScale) + 'px';
            this.canvas.style.height = (this.originalHeight * this.canvasScale) + 'px';
            this.updateZoomDisplay();
        } catch (error) {
            console.warn('Error applying zoom:', error);
        }
    }

    handleResize() {
        // ウィンドウサイズ変更時に表示を調整
        setTimeout(() => {
            this.fitToScreen();
        }, 100);
    }

    handleKeyDown(e) {
        // キーボードショートカット
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveAnnotations();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    this.zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    this.zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    this.actualSize();
                    break;
            }
        }
        
        // ESCで現在の操作をキャンセル
        if (e.key === 'Escape') {
            this.isDrawing = false;
            this.restoreState();
        }
    }

    // =============================================
    // PDF機能セクション
    // =============================================

    /**
     * PDF機能の初期化とチェック
     */
    initializePDFFeatures() {
        try {
            // jsPDFライブラリの存在確認
            if (typeof window.jspdf === 'undefined') {
                console.warn('jsPDF library not found');
                this.disablePDFButtons('jsPDFライブラリが見つかりません');
                return;
            }
            
            console.log('PDF features initialized successfully');
            this.enablePDFButtons();
            
        } catch (error) {
            console.error('PDF initialization error:', error);
            this.disablePDFButtons('PDF機能の初期化に失敗しました');
        }
    }

    /**
     * PDFボタンを無効化
     */
    disablePDFButtons(reason) {
        const pdfButtons = ['exportPdfBtn', 'exportProjectPdfBtn'];
        
        pdfButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                button.title = reason;
                
                // ボタンテキストを更新
                const originalText = button.textContent;
                button.innerHTML = `<span class="icon">⚠️</span>${originalText} (無効)`;
            }
        });
        
        // 警告メッセージを表示
        this.showWarning(`PDF機能が無効です: ${reason}`);
    }

    /**
     * PDFボタンを有効化
     */
    enablePDFButtons() {
        const pdfButtons = [
            { id: 'exportPdfBtn', text: '画面PDF', icon: '📄' },
            { id: 'exportProjectPdfBtn', text: 'プロジェクトPDF', icon: '📊' }
        ];
        
        pdfButtons.forEach(buttonConfig => {
            const button = document.getElementById(buttonConfig.id);
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                button.innerHTML = `<span class="icon">${buttonConfig.icon}</span>${buttonConfig.text}`;
                
                // ツールチップを設定
                if (buttonConfig.id === 'exportPdfBtn') {
                    button.title = 'この画面のPDF設計書を生成';
                } else {
                    button.title = 'プロジェクト全体のPDF設計書を生成';
                }
            }
        });
    }

    /**
     * PDF生成前の事前チェック
     */
    validatePDFGeneration() {
        // jsPDFライブラリのチェック
        if (typeof window.jspdf === 'undefined') {
            throw new Error('jsPDFライブラリが読み込まれていません。libs/jspdf.min.jsを配置してください。');
        }
        
        // 画面データのチェック
        if (!this.screenData) {
            throw new Error('画面データが見つかりません。');
        }
        
        // キャンバスのチェック
        if (!this.canvas) {
            throw new Error('キャンバスが初期化されていません。');
        }
        
        return true;
    }

    /**
     * 現在の画面のみのPDFを生成
     */
    async generateCurrentScreenPDF() {
        const button = document.getElementById('exportPdfBtn');
        
        try {
            // ボタンを無効化して重複実行を防止
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="icon">⏳</span>生成中...';
            }
            
            this.showNotification('PDF生成中...', 'info');
            
            // 事前チェック
            this.validatePDFGeneration();
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // 現在の画面のPDFを生成
            await this.generateScreenDetailPage(pdf, this.screenData, 1);
            
            // PDF保存
            const title = this.screenData.meta?.title || this.screenData.title || '画面設計';
            const safeTitle = title.replace(/[^\w\s-]/g, '').trim(); // ファイル名に使えない文字を除去
            const fileName = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            pdf.save(fileName);
            
            this.showSuccess(`PDF設計書を生成しました: ${fileName}`);
            
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showError('PDF生成に失敗しました: ' + error.message);
            
            // デバッグ情報を追加
            if (error.message.includes('jsPDF')) {
                this.showNotification('jsPDFライブラリを確認してください。libs/jspdf.min.jsが正しく配置されているか確認してください。', 'warning');
            }
        } finally {
            // ボタンを再有効化
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="icon">📄</span>画面PDF';
            }
        }
    }

    /**
     * プロジェクト全体のPDF設計書を生成
     */
    async generateProjectReport() {
        const button = document.getElementById('exportProjectPdfBtn');
        
        try {
            // ボタンを無効化
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="icon">⏳</span>生成中...';
            }
            
            this.showNotification('プロジェクトPDF生成中...', 'info');
            
            // 事前チェック
            this.validatePDFGeneration();
            
            // プロジェクトデータを取得
            const result = await chrome.storage.local.get(['currentProject', 'screens']);
            const project = result.currentProject;
            const allScreens = result.screens || [];
            
            if (!project) {
                throw new Error('プロジェクトが選択されていません');
            }
            
            // プロジェクトに属する画面を取得
            const projectScreens = allScreens.filter(screen => screen.projectId === project.id);
            
            if (projectScreens.length === 0) {
                throw new Error('このプロジェクトには画面がありません');
            }
            
            this.showNotification(`${projectScreens.length}画面のPDFを生成中...`, 'info');
            
            // jsPDFインスタンスを作成
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            let currentPage = 1;
            
            // 表紙を生成
            this.generateCoverPage(pdf, project, projectScreens.length);
            
            // 目次を生成
            pdf.addPage();
            currentPage++;
            this.generateTableOfContents(pdf, projectScreens, currentPage);
            
            // 各画面の詳細ページを生成
            for (let i = 0; i < projectScreens.length; i++) {
                this.showNotification(`画面 ${i + 1}/${projectScreens.length} を処理中...`, 'info');
                
                pdf.addPage();
                currentPage++;
                await this.generateScreenDetailPage(pdf, projectScreens[i], i + 1);
                
                // 少し待機（ブラウザがフリーズしないように）
                if (i % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // PDF保存
            const safeProjectName = project.name.replace(/[^\w\s-]/g, '').trim();
            const fileName = `${safeProjectName}_設計書_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            
            this.showSuccess(`PDF設計書を生成しました: ${fileName} (${projectScreens.length}画面)`);
            
        } catch (error) {
            console.error('Project PDF generation error:', error);
            this.showError('プロジェクトPDF生成に失敗しました: ' + error.message);
        } finally {
            // ボタンを再有効化
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="icon">📊</span>プロジェクトPDF';
            }
        }
    }

    /**
     * 表紙ページを生成
     */
    generateCoverPage(pdf, project, screenCount) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // 背景色
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // プロジェクトカラーのアクセント
        const color = this.hexToRgb(project.color || '#3b82f6');
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.rect(0, 0, pageWidth, 15, 'F');
        pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        // タイトル
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(28);
        pdf.setTextColor(60, 60, 60);
        const titleY = 50;
        pdf.text('UI設計書', pageWidth / 2, titleY, { align: 'center' });
        
        // プロジェクト名
        pdf.setFontSize(24);
        pdf.setTextColor(color.r, color.g, color.b);
        pdf.text(project.name || 'プロジェクト名未設定', pageWidth / 2, titleY + 20, { align: 'center' });
        
        // プロジェクト情報ボックス
        const boxY = 90;
        const boxHeight = 60;
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(220, 220, 220);
        pdf.roundedRect(20, boxY, pageWidth - 40, boxHeight, 3, 3, 'FD');
        
        // プロジェクト詳細情報
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(80, 80, 80);
        
        const infoStartY = boxY + 15;
        const lineHeight = 8;
        
        pdf.text('プロジェクト概要', 25, infoStartY);
        pdf.text(`画面数: ${screenCount}画面`, 25, infoStartY + lineHeight);
        pdf.text(`作成日: ${new Date(project.createdAt).toLocaleDateString('ja-JP')}`, 25, infoStartY + lineHeight * 2);
        pdf.text(`生成日: ${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}`, 25, infoStartY + lineHeight * 3);
        
        if (project.description) {
            pdf.text('説明:', 25, infoStartY + lineHeight * 4.5);
            const description = project.description.length > 50 ? 
                project.description.substring(0, 50) + '...' : project.description;
            pdf.text(description, 25, infoStartY + lineHeight * 5.5);
        }
        
        // ツール情報
        const toolInfoY = 190;
        pdf.setFontSize(10);
        pdf.setTextColor(120, 120, 120);
        pdf.text('Generated by ScreenSpec Chrome Extension', pageWidth / 2, toolInfoY, { align: 'center' });
        pdf.text('Professional UI Documentation Tool', pageWidth / 2, toolInfoY + 5, { align: 'center' });
        
        // バージョン情報
        pdf.text('Version 1.0', pageWidth / 2, toolInfoY + 15, { align: 'center' });
    }

    /**
     * 目次ページを生成
     */
    generateTableOfContents(pdf, screens, startPage) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        // ヘッダー
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(60, 60, 60);
        pdf.text('目次', 20, 30);
        
        // 区切り線
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, 35, pageWidth - 20, 35);
        
        // 目次項目
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(80, 80, 80);
        
        let yPosition = 50;
        const lineHeight = 8;
        
        // 概要セクション
        pdf.setFont('helvetica', 'bold');
        pdf.text('1. プロジェクト概要', 25, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += lineHeight * 1.5;
        
        // 画面一覧セクション
        pdf.setFont('helvetica', 'bold');
        pdf.text('2. 画面設計', 25, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += lineHeight;
        
        screens.forEach((screen, index) => {
            const pageNum = startPage + 1 + index;
            const title = screen.meta?.title || screen.title || `画面 ${index + 1}`;
            const functionName = screen.meta?.functionName ? ` (${screen.meta.functionName})` : '';
            
            yPosition += lineHeight;
            
            // ページ番号が右端に来るように調整
            const titleText = `2.${index + 1} ${title}${functionName}`;
            const pageText = `${pageNum}`;
            
            pdf.text(titleText, 30, yPosition);
            pdf.text(pageText, pageWidth - 25, yPosition, { align: 'right' });
            
            // 点線
            const titleWidth = pdf.getTextWidth(titleText);
            const pageWidth_calc = pdf.getTextWidth(pageText);
            const dotStartX = 30 + titleWidth + 5;
            const dotEndX = pageWidth - 25 - pageWidth_calc - 5;
            
            if (dotEndX > dotStartX) {
                pdf.setFontSize(8);
                let dotX = dotStartX;
                while (dotX < dotEndX - 5) {
                    pdf.text('.', dotX, yPosition);
                    dotX += 3;
                }
                pdf.setFontSize(12);
            }
            
            // 副情報があれば追加
            if (screen.meta?.description) {
                yPosition += lineHeight * 0.6;
                pdf.setFontSize(10);
                pdf.setTextColor(120, 120, 120);
                const description = screen.meta.description.length > 60 ? 
                    screen.meta.description.substring(0, 60) + '...' : screen.meta.description;
                pdf.text(description, 35, yPosition);
                pdf.setFontSize(12);
                pdf.setTextColor(80, 80, 80);
            }
        });
    }

    /**
     * 画面詳細ページを生成
     */
    async generateScreenDetailPage(pdf, screen, screenNumber) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // ヘッダー
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(60, 60, 60);
        const title = screen.meta?.title || screen.title || `画面 ${screenNumber}`;
        pdf.text(`${screenNumber}. ${title}`, 20, 25);
        
        // 区切り線
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, 30, pageWidth - 20, 30);
        
        // 画面情報テーブル
        let yPos = 40;
        
        if (screen.meta) {
            const infoHeight = this.generateScreenInfoTable(pdf, screen.meta, yPos);
            yPos += infoHeight + 10;
        }
        
        // 画面キャプチャを追加
        try {
            const imgData = screen.dataUrl;
            const imgProps = pdf.getImageProperties(imgData);
            
            // A4ページに収まるようにサイズ調整
            const maxWidth = pageWidth - 40; // 左右マージン20mmずつ
            const maxHeight = pageHeight - yPos - 30; // 上下余白を考慮
            
            const aspectRatio = imgProps.width / imgProps.height;
            let imgWidth = Math.min(maxWidth, imgProps.width * 0.1); // 画像を適度に縮小
            let imgHeight = imgWidth / aspectRatio;
            
            // 高さが制限を超える場合は高さ基準で調整
            if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight * aspectRatio;
            }
            
            // 画像を中央配置
            const imgX = (pageWidth - imgWidth) / 2;
            pdf.addImage(imgData, 'PNG', imgX, yPos, imgWidth, imgHeight);
            
            yPos += imgHeight + 10;
            
        } catch (error) {
            console.error('Error adding image to PDF:', error);
            // 画像追加に失敗した場合はプレースホルダー
            pdf.setFillColor(240, 240, 240);
            pdf.rect(20, yPos, pageWidth - 40, 100, 'F');
            pdf.setTextColor(150, 150, 150);
            pdf.text('画像を読み込めませんでした', pageWidth / 2, yPos + 50, { align: 'center' });
            yPos += 110;
        }
        
        // 注釈情報
        if (screen.annotations && screen.annotations.length > 0) {
            // 新しいページが必要かチェック
            if (yPos > pageHeight - 50) {
                pdf.addPage();
                yPos = 30;
            }
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(60, 60, 60);
            pdf.text('注釈詳細', 20, yPos);
            yPos += 10;
            
            this.generateAnnotationsList(pdf, screen.annotations, yPos);
        }
        
        // フッター
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`作成日: ${new Date(screen.createdAt).toLocaleDateString('ja-JP')}`, 20, pageHeight - 10);
        if (screen.url) {
            const url = screen.url.length > 50 ? screen.url.substring(0, 50) + '...' : screen.url;
            pdf.text(`URL: ${url}`, 20, pageHeight - 5);
        }
    }

    /**
     * 画面情報テーブルを生成
     */
    generateScreenInfoTable(pdf, meta, startY) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        let yPos = startY;
        
        // テーブルの設定
        const tableWidth = pageWidth - 40;
        const labelWidth = 40;
        const valueWidth = tableWidth - labelWidth;
        const rowHeight = 8;
        
        // テーブルヘッダー
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(220, 220, 220);
        
        const infoItems = [
            { label: '機能名', value: meta.functionName || '-' },
            { label: '作成者', value: meta.createdBy || '-' },
            { label: 'タグ', value: meta.tags || '-' },
            { label: '説明', value: meta.description || '-' }
        ];
        
        infoItems.forEach((item, index) => {
            const rowY = yPos + (index * rowHeight);
            
            // 背景
            if (index % 2 === 0) {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(20, rowY - 2, tableWidth, rowHeight, 'F');
            }
            
            // 枠線
            pdf.setDrawColor(230, 230, 230);
            pdf.rect(20, rowY - 2, labelWidth, rowHeight, 'S');
            pdf.rect(20 + labelWidth, rowY - 2, valueWidth, rowHeight, 'S');
            
            // テキスト
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(80, 80, 80);
            pdf.text(item.label, 22, rowY + 3);
            
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            
            // 長いテキストは改行
            if (item.value.length > 50) {
                const lines = pdf.splitTextToSize(item.value, valueWidth - 5);
                pdf.text(lines[0], 22 + labelWidth, rowY + 3);
                if (lines.length > 1) {
                    pdf.setFontSize(9);
                    pdf.text('...', 22 + labelWidth + pdf.getTextWidth(lines[0]), rowY + 3);
                }
            } else {
                pdf.text(item.value, 22 + labelWidth, rowY + 3);
            }
        });
        
        return infoItems.length * rowHeight;
    }

    /**
     * 注釈リストを生成
     */
    generateAnnotationsList(pdf, annotations, startY) {
        let yPos = startY;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        
        annotations.forEach((annotation, index) => {
            yPos += 6;
            
            let annotationText = `${index + 1}. `;
            
            switch (annotation.type) {
                case 'text':
                    annotationText += `テキスト: "${annotation.text}"`;
                    break;
                case 'arrow':
                    annotationText += `矢印 (${Math.round(annotation.startX)}, ${Math.round(annotation.startY)}) → (${Math.round(annotation.endX)}, ${Math.round(annotation.endY)})`;
                    break;
                case 'rect':
                    annotationText += `枠線 - 幅: ${Math.round(Math.abs(annotation.endX - annotation.startX))}px, 高さ: ${Math.round(Math.abs(annotation.endY - annotation.startY))}px`;
                    break;
                case 'highlight':
                    annotationText += `ハイライト - 範囲: ${Math.round(Math.abs(annotation.endX - annotation.startX))} × ${Math.round(Math.abs(annotation.endY - annotation.startY))}px`;
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(annotation.endX - annotation.startX, 2) + Math.pow(annotation.endY - annotation.startY, 2));
                    annotationText += `円形 - 半径: ${Math.round(radius)}px`;
                    break;
            }
            
            annotationText += ` (色: ${annotation.color})`;
            
            // カラーインジケーター
            const color = this.hexToRgb(annotation.color);
            pdf.setFillColor(color.r, color.g, color.b);
            pdf.circle(22, yPos - 1, 1, 'F');
            
            pdf.setTextColor(80, 80, 80);
            pdf.text(annotationText, 26, yPos);
        });
    }

    /**
     * HEX色をRGBに変換
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 59, g: 130, b: 246 }; // デフォルト色
    }

    /**
     * 通知機能（警告タイプ対応）
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showNotification(message, type = 'info') {
        try {
            // 既存の通知を削除
            const existingNotifications = document.querySelectorAll('.pdf-notification');
            existingNotifications.forEach(notif => notif.remove());
            
            // 新しい通知を作成
            const notification = document.createElement('div');
            notification.className = 'pdf-notification';
            
            const colors = {
                success: { bg: '#10b981', icon: '✅' },
                error: { bg: '#ef4444', icon: '❌' },
                warning: { bg: '#f59e0b', icon: '⚠️' },
                info: { bg: '#3b82f6', icon: 'ℹ️' }
            };
            
            const color = colors[type] || colors.info;
            
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${color.bg};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                max-width: 350px;
                word-wrap: break-word;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            notification.innerHTML = `
                <span style="font-size: 16px;">${color.icon}</span>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            // 自動削除（エラーは長めに表示）
            const duration = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
            
        } catch (error) {
            console.error('Failed to show notification:', error);
            // フォールバック
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// CSS for notifications
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
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// 初期化を段階的に実行
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // より詳細な要素チェック
    const checkElements = () => {
        const requiredElements = [
            'annotationCanvas',
            'colorPicker', 
            'undoBtn',
            'saveBtn',
            'metaToggle',
            'saveMetaBtn',
            'exportPdfBtn',
            'exportProjectPdfBtn'
        ];
        
        const foundElements = {};
        const missingElements = [];
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                foundElements[id] = element;
                console.log(`✓ Found element: ${id}`);
            } else {
                missingElements.push(id);
                console.warn(`✗ Missing element: ${id}`);
            }
        });
        
        return { foundElements, missingElements };
    };
    
    // 段階的な初期化
    const initializeEditor = (attempt = 1) => {
        console.log(`Initialization attempt ${attempt}`);
        
        try {
            const { foundElements, missingElements } = checkElements();
            
            // 最低限必要な要素（キャンバス）があるかチェック
            if (!foundElements.annotationCanvas) {
                if (attempt < 5) {
                    console.log(`Canvas not found, retrying in ${attempt}s...`);
                    setTimeout(() => initializeEditor(attempt + 1), attempt * 1000);
                    return;
                } else {
                    throw new Error('Canvas element not found after multiple attempts');
                }
            }
            
            if (missingElements.length > 0) {
                console.warn(`Proceeding with missing elements: ${missingElements.join(', ')}`);
            }
            
            console.log('Starting AnnotationEditor initialization...');
            new AnnotationEditor();
            
        } catch (error) {
            console.error(`Initialization attempt ${attempt} failed:`, error);
            
            if (attempt < 3) {
                console.log(`Retrying in ${attempt * 2}s...`);
                setTimeout(() => initializeEditor(attempt + 1), attempt * 2000);
            } else {
                console.error('All initialization attempts failed');
                
                // 最終フォールバック
                const errorMessage = `注釈エディターの初期化に失敗しました。\n\n詳細: ${error.message}\n\nページを再読み込みしてください。`;
                
                // より目立つエラー表示
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #fee2e2;
                    border: 2px solid #fca5a5;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                    z-index: 10000;
                    font-family: system-ui, sans-serif;
                `;
                errorDiv.innerHTML = `
                    <h3 style="color: #dc2626; margin: 0 0 10px 0;">⚠️ 初期化エラー</h3>
                    <p style="margin: 0 0 15px 0; color: #374151;">${error.message}</p>
                    <button onclick="window.location.reload()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        ページを再読み込み
                    </button>
                `;
                
                document.body.appendChild(errorDiv);
            }
        }
    };
    
    // 500ms後に初期化開始
    setTimeout(() => initializeEditor(1), 500);
});