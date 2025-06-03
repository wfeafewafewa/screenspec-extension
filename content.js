// ScreenSpec Content Script - 最小テスト版
console.log('🚀 ScreenSpec content script loaded successfully!');

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message received:', message);
    
    if (message.action === 'ping') {
        console.log('📡 Ping received, responding...');
        sendResponse({ status: 'ready' });
        return true;
    }
    
    if (message.action === 'startAnnotation') {
        console.log('🎨 Starting annotation mode for screen:', message.screenId);
        
        // 既存のオーバーレイを削除
        const existing = document.getElementById('screenspec-test-overlay');
        if (existing) {
            existing.remove();
        }

        // テスト用オーバーレイを作成
        const overlay = document.createElement('div');
        overlay.id = 'screenspec-test-overlay';
        overlay.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 999999;
                text-align: center;
                font-family: Arial, sans-serif;
                border: 3px solid #4CAF50;
            ">
                <h2 style="color: #4CAF50; margin: 0 0 20px 0;">🎉 成功！</h2>
                <p style="margin: 10px 0; font-size: 16px;">注釈モードが正常に開始されました</p>
                <p style="margin: 10px 0; color: #666; font-size: 14px;">Screen ID: ${message.screenId}</p>
                <button id="close-test" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-top: 20px;
                ">閉じる</button>
            </div>
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                z-index: 999998;
            "></div>
        `;

        document.body.appendChild(overlay);

        // 閉じるボタンのイベント
        document.getElementById('close-test').addEventListener('click', () => {
            overlay.remove();
        });

        sendResponse({ success: true });
        return true;
    }
    
    return true;
});

console.log('✅ ScreenSpec content script initialization complete!');