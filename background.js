/**
 * ScreenSpec - Background Script
 * Chrome拡張機能のバックグラウンド処理（ローカルjsPDF使用）
 */

console.log('ScreenSpec background loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('ScreenSpec installed successfully');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    switch (request.action) {
        case 'captureScreen':
            captureScreenSimple(request, sendResponse);
            return true; // 非同期レスポンス
            
        case 'exportPDF':
            exportPDFViaContentScript(request, sendResponse);
            return true; // 非同期レスポンス
            
        default:
            console.warn('Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action: ' + request.action });
            return false;
    }
});

/**
 * 画面キャプチャ機能
 */
async function captureScreenSimple(request, sendResponse) {
    try {
        console.log('Starting capture...', request.type);
        
        // アクティブタブの情報を取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        let dataUrl;
        if (request.type === 'visible') {
            // 表示部分のキャプチャ
            dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 90
            });
        } else if (request.type === 'full') {
            // ページ全体のキャプチャ（表示部分のみでも対応）
            dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 90
            });
        } else {
            throw new Error('Invalid capture type: ' + request.type);
        }
        
        console.log('Capture successful!');
        
        // 画面データを作成
        const screen = {
            id: Date.now().toString(),
            projectId: request.projectId,
            type: request.type,
            title: tab.title || 'キャプチャ画面',
            url: tab.url || 'unknown',
            dataUrl: dataUrl,
            thumbnail: dataUrl,
            createdAt: new Date().toISOString(),
            annotations: []
        };
        
        // ストレージに保存
        const result = await chrome.storage.local.get(['screens']);
        const screens = result.screens || [];
        screens.push(screen);
        await chrome.storage.local.set({ screens });
        
        // プロジェクトのスクリーン数を更新
        await updateProjectScreenCount(request.projectId);
        
        console.log('Screen saved!');
        sendResponse({ success: true, screen: screen });
        
    } catch (error) {
        console.error('Capture error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * PDF出力機能（Content Scriptに委譲）
 */
async function exportPDFViaContentScript(request, sendResponse) {
    try {
        console.log('Starting PDF export...', request.project.name);
        
        const { project, screens } = request;
        
        if (!screens || screens.length === 0) {
            throw new Error('出力する画面がありません');
        }
        
        // アクティブタブを取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // jsPDFライブラリを先に注入
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['libs/jspdf.min.js']
        });
        
        // 少し待ってからPDF生成スクリプトを実行
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // PDF生成スクリプトを実行
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: generatePDFInContentScript,
            args: [project, screens]
        });
        
        if (results && results[0] && results[0].result) {
            const result = results[0].result;
            if (result.success) {
                console.log('PDF export completed!');
                sendResponse({ success: true, filename: result.filename });
            } else {
                throw new Error(result.error);
            }
        } else {
            throw new Error('PDF生成の結果を取得できませんでした');
        }
        
    } catch (error) {
        console.error('PDF export error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * Content Script内で実行されるPDF生成関数（全ての必要な関数を含む）
 */
function generatePDFInContentScript(project, screens) {
    try {
        console.log('PDF generation started for project:', project.name);
        
        // jsPDFクラスを取得
        let jsPDFClass = null;
        if (window.jspdf && window.jspdf.jsPDF) {
            jsPDFClass = window.jspdf.jsPDF;
        } else if (window.jsPDF) {
            jsPDFClass = window.jsPDF;
        } else if (typeof jsPDF !== 'undefined') {
            jsPDFClass = jsPDF;
        } else {
            return { success: false, error: 'jsPDFライブラリが見つかりません' };
        }
        
        const doc = new jsPDFClass({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        console.log('Creating PDF with', screens.length, 'screens');
        
        // 日本語テキストを HTML として描画して画像化
        function createJapaneseTextAsImage(text, fontSize = 16, options = {}) {
            return new Promise((resolve) => {
                try {
                    // HTML要素を作成
                    const container = document.createElement('div');
                    container.innerHTML = text;
                    container.style.cssText = `
                        position: fixed;
                        top: -9999px;
                        left: -9999px;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
                        font-size: ${fontSize}px;
                        color: #000000;
                        background: white;
                        padding: 8px 12px;
                        white-space: nowrap;
                        line-height: 1.4;
                        border-radius: 4px;
                        box-shadow: none;
                        z-index: 999999;
                        ${options.fontWeight ? `font-weight: ${options.fontWeight};` : ''}
                        ${options.textAlign ? `text-align: ${options.textAlign};` : ''}
                    `;
                    
                    document.body.appendChild(container);
                    
                    // html2canvasが利用可能かチェック
                    if (typeof html2canvas !== 'undefined') {
                        html2canvas(container, {
                            backgroundColor: 'white',
                            scale: 2,
                            useCORS: true,
                            allowTaint: true
                        }).then(canvas => {
                            document.body.removeChild(container);
                            resolve({
                                dataUrl: canvas.toDataURL('image/png'),
                                width: canvas.width / 2, // scale=2なので半分に
                                height: canvas.height / 2
                            });
                        }).catch(error => {
                            console.error('html2canvas failed:', error);
                            document.body.removeChild(container);
                            resolve(null);
                        });
                    } else {
                        // html2canvasが使えない場合はCanvasで描画
                        const rect = container.getBoundingClientRect();
                        const width = rect.width + 24;
                        const height = rect.height + 16;
                        
                        document.body.removeChild(container);
                        
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = width * 2;
                        canvas.height = height * 2;
                        ctx.scale(2, 2);
                        
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        
                        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
                        ctx.fillStyle = '#000000';
                        ctx.textAlign = options.textAlign || 'left';
                        ctx.textBaseline = 'middle';
                        
                        const x = options.textAlign === 'center' ? width / 2 : 12;
                        ctx.fillText(text, x, height / 2);
                        
                        resolve({
                            dataUrl: canvas.toDataURL('image/png'),
                            width: width,
                            height: height
                        });
                    }
                } catch (error) {
                    console.error('Text image creation failed:', error);
                    resolve(null);
                }
            });
        }
        
        // 同期版（Promiseを使わない簡易版）
        function createJapaneseTextImageSync(text, fontSize = 16) {
            try {
                // DOM要素を作成してサイズを測定
                const measureDiv = document.createElement('div');
                measureDiv.innerHTML = text;
                measureDiv.style.cssText = `
                    position: absolute;
                    top: -9999px;
                    left: -9999px;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: ${fontSize}px;
                    white-space: nowrap;
                    visibility: hidden;
                `;
                document.body.appendChild(measureDiv);
                
                const rect = measureDiv.getBoundingClientRect();
                const width = Math.max(100, rect.width + 24);
                const height = Math.max(30, fontSize * 1.6);
                
                document.body.removeChild(measureDiv);
                
                // Canvas で描画
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const scale = 2;
                canvas.width = width * scale;
                canvas.height = height * scale;
                ctx.scale(scale, scale);
                
                // 白背景
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                
                // テキスト描画
                ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.textRenderingOptimization = 'optimizeQuality';
                
                ctx.fillText(text, width / 2, height / 2);
                
                return {
                    dataUrl: canvas.toDataURL('image/png', 1.0),
                    width: width,
                    height: height
                };
            } catch (error) {
                console.error('Text image creation failed:', error);
                return null;
            }
        }
        
        // ユーティリティ関数
        function sanitizeFilename(filename) {
            return filename.replace(/[^\w\s-_.]/g, '').trim() || 'ScreenSpec_Document';
        }
        
        function formatDateForDoc(date) {
            const d = typeof date === 'string' ? new Date(date) : date;
            return d.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        function formatDateForFilename(date) {
            return date.toISOString().slice(0, 19).replace(/[T:]/g, '-').replace(/-/g, '');
        }
        
        // タイトルページ追加
        function addTitlePageToDoc(doc, project) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const centerX = pageWidth / 2;
            
            // タイトル
            const titleImg = createJapaneseTextImageSync('画面設計書', 24);
            if (titleImg) {
                const mmWidth = titleImg.width * 0.264583;
                const mmHeight = titleImg.height * 0.264583;
                doc.addImage(titleImg.dataUrl, 'PNG', centerX - mmWidth/2, 45, mmWidth, mmHeight);
            }
            
            // プロジェクト名
            const projectImg = createJapaneseTextImageSync(project.name, 18);
            if (projectImg) {
                const mmWidth = projectImg.width * 0.264583;
                const mmHeight = projectImg.height * 0.264583;
                doc.addImage(projectImg.dataUrl, 'PNG', centerX - mmWidth/2, 70, mmWidth, mmHeight);
            }
            
            // 説明
            if (project.description) {
                const descImg = createJapaneseTextImageSync(project.description, 12);
                if (descImg) {
                    const mmWidth = Math.min(pageWidth - 20, descImg.width * 0.264583);
                    const mmHeight = descImg.height * 0.264583;
                    doc.addImage(descImg.dataUrl, 'PNG', centerX - mmWidth/2, 95, mmWidth, mmHeight);
                }
            }
            
            // 作成日・画面数
            const dateImg = createJapaneseTextImageSync(`作成日: ${formatDateForDoc(new Date())}`, 10);
            const countImg = createJapaneseTextImageSync(`総画面数: ${project.screenCount || 0}画面`, 10);
            
            if (dateImg) {
                const mmWidth = dateImg.width * 0.264583;
                const mmHeight = dateImg.height * 0.264583;
                doc.addImage(dateImg.dataUrl, 'PNG', centerX - mmWidth/2, 125, mmWidth, mmHeight);
            }
            
            if (countImg) {
                const mmWidth = countImg.width * 0.264583;
                const mmHeight = countImg.height * 0.264583;
                doc.addImage(countImg.dataUrl, 'PNG', centerX - mmWidth/2, 140, mmWidth, mmHeight);
            }
            
            // フッター
            const footerImg = createJapaneseTextImageSync('ScreenSpec - 画面設計書作成ツール', 8);
            if (footerImg) {
                const mmWidth = footerImg.width * 0.264583;
                const mmHeight = footerImg.height * 0.264583;
                doc.addImage(footerImg.dataUrl, 'PNG', centerX - mmWidth/2, pageHeight - 25, mmWidth, mmHeight);
            }
        }
        
        // 画面ページ追加
        function addScreenToDoc(doc, screen, pageNumber) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            const maxImageHeight = pageHeight - 140;
            
            // ヘッダー
            const headerImg = createJapaneseTextImageSync(`${pageNumber}. 画面キャプチャ`, 14);
            if (headerImg) {
                const mmWidth = headerImg.width * 0.264583;
                const mmHeight = headerImg.height * 0.264583;
                doc.addImage(headerImg.dataUrl, 'PNG', margin, 20, mmWidth, mmHeight);
            }
            
            // タイトル
            const titleImg = createJapaneseTextImageSync(`タイトル: ${screen.title}`, 12);
            if (titleImg) {
                const mmWidth = Math.min(contentWidth, titleImg.width * 0.264583);
                const mmHeight = titleImg.height * 0.264583;
                doc.addImage(titleImg.dataUrl, 'PNG', margin, 35, mmWidth, mmHeight);
            }
            
            // URL（英語）
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const url = screen.url.length > 75 ? screen.url.substring(0, 75) + '...' : screen.url;
            doc.text(`URL: ${url}`, margin, 50);
            
            // 作成日・タイプ
            const dateImg = createJapaneseTextImageSync(`作成日: ${formatDateForDoc(screen.createdAt)}`, 9);
            const typeImg = createJapaneseTextImageSync(`キャプチャタイプ: ${screen.type === 'visible' ? '表示部分' : 'ページ全体'}`, 9);
            
            if (dateImg) {
                const mmWidth = dateImg.width * 0.264583;
                const mmHeight = dateImg.height * 0.264583;
                doc.addImage(dateImg.dataUrl, 'PNG', margin, 55, mmWidth, mmHeight);
            }
            
            if (typeImg) {
                const mmWidth = typeImg.width * 0.264583;
                const mmHeight = typeImg.height * 0.264583;
                doc.addImage(typeImg.dataUrl, 'PNG', margin, 65, mmWidth, mmHeight);
            }
            
            // スクリーン画像
            const imgWidth = contentWidth;
            let imgHeight = (imgWidth * 9) / 16;
            if (imgHeight > maxImageHeight) {
                imgHeight = maxImageHeight;
            }
            
            const imgY = 80;
            doc.addImage(screen.dataUrl, 'PNG', margin, imgY, imgWidth, imgHeight);
            
            // ページフッター
            doc.setFontSize(8);
            doc.text(`${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
        
        // PDFを生成
        addTitlePageToDoc(doc, project);
        
        screens.forEach((screen, index) => {
            console.log('Adding screen', index + 1, ':', screen.title);
            doc.addPage();
            addScreenToDoc(doc, screen, index + 1);
        });
        
        // PDFを保存
        const filename = `${sanitizeFilename(project.name)}_${formatDateForFilename(new Date())}.pdf`;
        doc.save(filename);
        
        console.log('PDF generation completed:', filename);
        return { success: true, filename: filename };
        
    } catch (error) {
        console.error('PDF generation error:', error);
        return { success: false, error: error.message };
    }
}

// ここのユーティリティ関数たちは削除（Content Script内で定義するため）

/**
 * プロジェクトのスクリーン数を更新
 */
async function updateProjectScreenCount(projectId) {
    try {
        const result = await chrome.storage.local.get(['projects', 'screens']);
        const projects = result.projects || [];
        const screens = result.screens || [];
        
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.screenCount = screens.filter(s => s.projectId === projectId).length;
            await chrome.storage.local.set({ projects });
        }
    } catch (error) {
        console.error('Failed to update project screen count:', error);
    }
}