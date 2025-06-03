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
                <button class="btn btn-secondary btn-small" onclick="screenSpecPopup.editScreen('${screen.id}')">
                    編集
                </button>
                <button class="btn btn-secondary btn-small" onclick="screenSpecPopup.deleteScreen('${screen.id}')">
                    削除
                </button>
            </div>
        `;
        return item;
    }

    async editScreen(screenId) {
        // 注釈モードを開く
        this.openAnnotationMode(screenId);
        window.close(); // ポップアップを閉じる
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