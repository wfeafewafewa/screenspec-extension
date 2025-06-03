class ScreenSpecBackground {
    constructor() {
        this.init();
    }

    init() {
        // メッセージリスナーを設定
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 非同期レスポンスを有効にする
        });

        // インストール時の初期化
        chrome.runtime.onInstalled.addListener(() => {
            this.onInstalled();
        });
    }

    onInstalled() {
        console.log('ScreenSpec がインストールされました');
        
        // 初期データ構造を設定
        chrome.storage.local.get(['screens'], (result) => {
            if (!result.screens) {
                chrome.storage.local.set({ screens: [] });
            }
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'fullPageCaptured':
                    await this.handleFullPageCapture(message, sender);
                    break;
                
                case 'captureError':
                    this.handleCaptureError(message, sender);
                    break;
                
                case 'exportPDF':
                    await this.handlePDFExport(message);
                    break;
                
                default:
                    console.log('Unknown message action:', message.action);
            }
        } catch (error) {
            console.error('Background script error:', error);
        }
    }

    async handleFullPageCapture(message, sender) {
        try {
            const screenData = {
                id: Date.now().toString(),
                dataUrl: message.dataUrl,
                url: message.url,
                title: message.title,
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
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            screens.push(screenData);
            await chrome.storage.local.set({ screens });

            // ポップアップに通知（開いている場合）
            try {
                chrome.runtime.sendMessage({
                    action: 'captureComplete',
                    screenData: screenData
                });
            } catch (e) {
                // ポップアップが開いていない場合のエラーを無視
            }

            // 成功通知
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'ScreenSpec',
                message: 'フルページキャプチャが完了しました'
            });

        } catch (error) {
            console.error('フルページキャプチャ処理エラー:', error);
        }
    }

    handleCaptureError(message, sender) {
        console.error('キャプチャエラー:', message.error);
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'ScreenSpec - エラー',
            message: 'キャプチャに失敗しました: ' + message.error
        });
    }

    async handlePDFExport(message) {
        try {
            const screens = message.screens;
            
            if (!screens || screens.length === 0) {
                throw new Error('書き出す画面がありません');
            }

            // 簡易PDF生成（将来的にはjsPDFを使用）
            const exportData = this.generatePDFData(screens);
            
            // ダウンロード用のBlobを作成
            const blob = new Blob([exportData], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // ダウンロードを実行
            chrome.downloads.download({
                url: url,
                filename: `screenspec-${new Date().toISOString().split('T')[0]}.pdf`,
                saveAs: true
            });

            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'ScreenSpec',
                message: 'PDF書き出しが完了しました'
            });

        } catch (error) {
            console.error('PDF書き出しエラー:', error);
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'ScreenSpec - エラー',
                message: 'PDF書き出しに失敗しました'
            });
        }
    }

    generatePDFData(screens) {
        // 簡易的なPDFデータ生成
        // 実際の実装ではjsPDFライブラリを使用
        let pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000103 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
167
%%EOF`;

        return pdfContent;
    }

    // タブが更新された時の処理
    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete') {
            // content scriptに設定の同期などを行う場合
        }
    }

    // ストレージの管理
    async cleanupOldData() {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            
            // 30日以上古いデータを削除
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentScreens = screens.filter(screen => {
                const screenDate = new Date(screen.timestamp);
                return screenDate > thirtyDaysAgo;
            });

            if (recentScreens.length !== screens.length) {
                await chrome.storage.local.set({ screens: recentScreens });
                console.log(`${screens.length - recentScreens.length}件の古いデータを削除しました`);
            }
        } catch (error) {
            console.error('データクリーンアップエラー:', error);
        }
    }
}

// バックグラウンドスクリプト初期化
const screenSpecBackground = new ScreenSpecBackground();

// 定期的なデータクリーンアップ（1日1回）
chrome.alarms.create('dataCleanup', { delayInMinutes: 1440, periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dataCleanup') {
        screenSpecBackground.cleanupOldData();
    }
});