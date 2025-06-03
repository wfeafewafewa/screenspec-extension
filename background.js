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
                
                case 'saveAnnotations':
                    await this.handleSaveAnnotations(message, sendResponse);
                    break;
                
                default:
                    console.log('Unknown message action:', message.action);
            }
        } catch (error) {
            console.error('Background script error:', error);
        }
    }

    async handleSaveAnnotations(message, sendResponse) {
        try {
            const { screens = [] } = await chrome.storage.local.get(['screens']);
            const screenIndex = screens.findIndex(s => s.id === message.screenId);
            
            if (screenIndex !== -1) {
                screens[screenIndex].annotations = message.annotations;
                screens[screenIndex].lastModified = new Date().toISOString();
                
                // メタ情報を保存
                if (message.metadata) {
                    screens[screenIndex].metadata = {
                        ...screens[screenIndex].metadata,
                        ...message.metadata
                    };
                }
                
                await chrome.storage.local.set({ screens });
                
                console.log('注釈とメタ情報が保存されました:', message.screenId);
                sendResponse({ success: true });
            } else {
                console.error('画面が見つかりません:', message.screenId);
                sendResponse({ success: false, error: 'Screen not found' });
            }
        } catch (error) {
            console.error('注釈保存エラー:', error);
            sendResponse({ success: false, error: error.message });
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

            console.log('📄 Starting simplified PDF generation for', screens.length, 'screens');

            // 簡素化されたPDF生成
            const htmlContent = this.generateHTMLReport(screens);
            
            // HTMLをBlobとしてダウンロード（PDF代替）
            const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            // ダウンロードを実行
            const timestamp = new Date().toISOString().split('T')[0];
            await chrome.downloads.download({
                url: url,
                filename: `ScreenSpec設計書_${timestamp}.html`,
                saveAs: true
            });

            // 成功通知
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'ScreenSpec',
                message: '📄 HTML設計書の書き出しが完了しました！ブラウザで開いてPDF印刷できます。'
            });

            // URLを解放
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {
            console.error('❌ PDF書き出しエラー:', error);
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'ScreenSpec - エラー',
                message: 'PDF書き出しに失敗しました: ' + error.message
            });
        }
    }

    generateHTMLReport(screens) {
        const totalAnnotations = screens.reduce((sum, screen) => sum + (screen.annotations?.length || 0), 0);
        const authors = [...new Set(screens.map(s => s.metadata?.author).filter(a => a))];
        const now = new Date();
        
        let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScreenSpec 設計書</title>
    <style>
        body {
            font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f9f9f9;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .cover {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        .cover h1 {
            font-size: 2.5em;
            color: #007bff;
            margin-bottom: 20px;
        }
        .cover .stats {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            display: inline-block;
        }
        .toc {
            margin-bottom: 40px;
        }
        .toc h2 {
            color: #007bff;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 10px;
        }
        .toc-item {
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .screen-section {
            margin: 40px 0;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            overflow: hidden;
        }
        .screen-header {
            background: #007bff;
            color: white;
            padding: 20px;
        }
        .screen-content {
            padding: 30px;
        }
        .screen-image {
            max-width: 100%;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .metadata-item {
            margin: 5px 0;
        }
        .tag {
            background: #e9ecef;
            color: #495057;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.9em;
            margin-right: 5px;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
            .screen-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 表紙 -->
        <div class="cover">
            <h1>📋 ScreenSpec 設計書</h1>
            <div class="stats">
                <div><strong>📅 作成日:</strong> ${now.toLocaleDateString('ja-JP')}</div>
                <div><strong>📊 総画面数:</strong> ${screens.length}画面</div>
                <div><strong>🎨 総注釈数:</strong> ${totalAnnotations}個</div>
                ${authors.length > 0 ? `<div><strong>👤 作成者:</strong> ${authors.join(', ')}</div>` : ''}
            </div>
        </div>

        <!-- 目次 -->
        <div class="toc">
            <h2>📑 目次</h2>
            ${screens.map((screen, index) => {
                const title = screen.metadata?.screenName || screen.title || `画面 ${index + 1}`;
                const functionName = screen.metadata?.functionName || '';
                return `
                    <div class="toc-item">
                        <strong>${index + 1}. ${title}</strong>
                        ${functionName ? `<br><small style="color: #666;">⚙️ ${functionName}</small>` : ''}
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
                            ${metadata.functionName ? `<div class="metadata-item"><strong>⚙️ 機能:</strong> ${metadata.functionName}</div>` : ''}
                            ${metadata.author ? `<div class="metadata-item"><strong>👤 作成者:</strong> ${metadata.author}</div>` : ''}
                            ${metadata.tags ? `<div class="metadata-item"><strong>🏷️ タグ:</strong> ${metadata.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}</div>` : ''}
                            <div class="metadata-item"><strong>📅 作成日:</strong> ${createdDate}</div>
                            ${modifiedDate && modifiedDate !== createdDate ? `<div class="metadata-item"><strong>🔄 更新日:</strong> ${modifiedDate}</div>` : ''}
                            <div class="metadata-item"><strong>🎨 注釈数:</strong> ${annotationCount}個</div>
                        </div>
                        
                        ${screen.dataUrl ? `<img src="${screen.dataUrl}" alt="${title}" class="screen-image">` : '<p style="color: #666;">画像データがありません</p>'}
                        
                        ${metadata.description ? `
                            <div style="margin-top: 20px;">
                                <h4>📝 説明</h4>
                                <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${metadata.description}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('')}

        <!-- フッター -->
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666;">
            <small>Generated by ScreenSpec v1.0.0 - ${now.toLocaleString('ja-JP')}</small>
        </div>
    </div>
</body>
</html>`;
        
        return html;
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
// alarms APIが利用可能かチェック
if (chrome.alarms) {
    chrome.alarms.create('dataCleanup', { delayInMinutes: 1440, periodInMinutes: 1440 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'dataCleanup') {
            screenSpecBackground.cleanupOldData();
        }
    });
} else {
    console.log('Alarms API is not available');
}