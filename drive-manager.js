/**
 * Google Drive Manager - ScreenSpec (デバッグ強化版)
 * 同期処理の競合を解決し、詳細ログを追加
 */
class DriveManager {
    constructor() {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.userInfo = null;
        this.folderIds = {
            root: null,
            projects: null,
            shared: null
        };
        this.syncInProgress = false;
        this.projectFolderCache = new Map();
        this.debugMode = true; // デバッグモード有効
    }

    log(message, data = null) {
        if (this.debugMode) {
            console.log(`[DriveManager] ${message}`, data || '');
        }
    }

    error(message, error = null) {
        console.error(`[DriveManager ERROR] ${message}`, error || '');
    }

    /**
     * Google Drive APIの初期化
     */
    async initialize() {
        try {
            this.log('Initializing Google Drive Manager...');
            
            // Chrome Identity APIを使用してGoogle認証
            const token = await this.getAuthToken();
            if (token) {
                this.accessToken = token;
                this.isAuthenticated = true;
                
                // ユーザー情報を取得
                await this.loadUserInfo();
                
                // フォルダ構造を初期化
                await this.initializeFolderStructure();
                
                this.log('Google Drive initialized successfully');
                return true;
            }
        } catch (error) {
            this.error('Drive initialization failed:', error);
            throw error;
        }
        return false;
    }

    /**
     * Google認証トークンを取得
     */
    async getAuthToken() {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(token);
                }
            });
        });
    }

    /**
     * 既存認証をチェック（非インタラクティブ）
     */
    async checkExistingAuth() {
        return new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    resolve(null);
                } else {
                    resolve(token);
                }
            });
        });
    }

    /**
     * ユーザー情報を取得
     */
    async loadUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.ok) {
                this.userInfo = await response.json();
                this.log('User info loaded:', this.userInfo.email);
                return this.userInfo;
            } else {
                throw new Error(`Failed to load user info: ${response.status}`);
            }
        } catch (error) {
            this.error('Failed to load user info:', error);
            throw error;
        }
    }

    /**
     * Drive上にフォルダ構造を初期化
     */
    async initializeFolderStructure() {
        try {
            this.log('Initializing folder structure...');
            
            // ScreenSpecルートフォルダを作成/取得
            this.folderIds.root = await this.findOrCreateFolder('ScreenSpec', null);
            this.log('Root folder ID:', this.folderIds.root);
            
            // プロジェクトフォルダを作成/取得
            this.folderIds.projects = await this.findOrCreateFolder('Projects', this.folderIds.root);
            this.log('Projects folder ID:', this.folderIds.projects);
            
            // 共有フォルダを作成/取得
            this.folderIds.shared = await this.findOrCreateFolder('Shared', this.folderIds.root);
            this.log('Shared folder ID:', this.folderIds.shared);
            
            this.log('Folder structure initialized successfully');
        } catch (error) {
            this.error('Failed to initialize folder structure:', error);
            throw error;
        }
    }

    /**
     * フォルダを検索または作成
     */
    async findOrCreateFolder(name, parentId = null) {
        try {
            this.log(`Finding or creating folder: ${name}`, { parentId });
            
            // 既存フォルダを検索
            const query = parentId 
                ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
                : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            
            this.log('Search query:', query);
            
            const searchResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!searchResponse.ok) {
                throw new Error(`Search failed: ${searchResponse.status}`);
            }
            
            const searchResult = await searchResponse.json();
            this.log('Search result:', searchResult);
            
            if (searchResult.files && searchResult.files.length > 0) {
                this.log(`Found existing folder: ${name} (${searchResult.files[0].id})`);
                return searchResult.files[0].id;
            }
            
            // フォルダが存在しない場合は作成
            this.log(`Creating new folder: ${name}`);
            const folderMetadata = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : undefined
            };
            
            const createResponse = await fetch(
                'https://www.googleapis.com/drive/v3/files',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(folderMetadata)
                }
            );
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Create folder failed: ${createResponse.status} - ${errorText}`);
            }
            
            const newFolder = await createResponse.json();
            this.log(`Created folder: ${name} (${newFolder.id})`);
            return newFolder.id;
            
        } catch (error) {
            this.error(`Failed to find or create folder ${name}:`, error);
            throw error;
        }
    }

    /**
     * プロジェクトをDriveにアップロード（修正版）
     */
    async uploadProject(project, screens = []) {
        try {
            // 同期フラグをチェック（より詳細に）
            if (this.syncInProgress) {
                this.error('Sync already in progress, skipping upload');
                throw new Error('同期処理が進行中です');
            }
            
            this.syncInProgress = true;
            this.log(`Starting upload for project: ${project.name}`, { projectId: project.id });
            
            // プロジェクト専用フォルダを作成
            const safeName = project.name.replace(/[^a-zA-Z0-9\s\-_]/g, '');
            const folderName = `${safeName}_${project.id}`;
            
            this.log(`Creating project folder: ${folderName}`);
            
            // フォルダ構造が初期化されているか確認
            if (!this.folderIds.projects) {
                this.log('Projects folder not initialized, initializing now...');
                await this.initializeFolderStructure();
            }
            
            const projectFolderId = await this.findOrCreateFolder(
                folderName, 
                this.folderIds.projects
            );
            
            // フォルダIDをキャッシュ
            this.projectFolderCache.set(project.id, projectFolderId);
            this.log(`Project folder created/found: ${folderName} (${projectFolderId})`);
            
            // プロジェクト情報をアップロード
            const projectData = {
                ...project,
                uploadedAt: new Date().toISOString(),
                uploadedBy: this.userInfo?.email || 'unknown',
                driveVersion: '1.0'
            };
            
            this.log('Uploading project metadata...');
            await this.uploadJsonFile(
                `project_${project.id}.json`,
                projectData,
                projectFolderId
            );
            
            // 画面データをアップロード
            this.log(`Uploading ${screens.length} screens...`);
            for (let i = 0; i < screens.length; i++) {
                this.log(`Uploading screen ${i + 1}/${screens.length}: ${screens[i].id}`);
                await this.uploadScreen(screens[i], projectFolderId);
            }
            
            this.log(`Project upload completed successfully: ${project.name}`);
            return projectFolderId;
            
        } catch (error) {
            this.error('Failed to upload project:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
            this.log('Upload process finished, sync flag cleared');
        }
    }

    /**
     * 画面データをDriveにアップロード
     */
    async uploadScreen(screen, projectFolderId) {
        try {
            this.log(`Uploading screen: ${screen.id}`);
            
            // 画像データを分離
            const imageData = screen.dataUrl;
            const screenMetadata = {
                ...screen,
                dataUrl: null, // 画像は別ファイルで保存
                uploadedAt: new Date().toISOString()
            };
            
            // メタデータをアップロード
            await this.uploadJsonFile(
                `screen_${screen.id}.json`,
                screenMetadata,
                projectFolderId
            );
            
            // 画像データをアップロード
            if (imageData) {
                this.log(`Uploading image for screen: ${screen.id}`);
                const base64Data = imageData.split(',')[1];
                const binaryData = atob(base64Data);
                const uint8Array = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                    uint8Array[i] = binaryData.charCodeAt(i);
                }
                
                await this.uploadBinaryFile(
                    `screen_${screen.id}.png`,
                    uint8Array,
                    'image/png',
                    projectFolderId
                );
            }
            
            this.log(`Screen uploaded successfully: ${screen.id}`);
            
        } catch (error) {
            this.error('Failed to upload screen:', error);
            throw error;
        }
    }

    /**
     * JSONファイルをアップロード
     */
    async uploadJsonFile(fileName, data, parentId) {
        return await this.uploadFile(
            fileName,
            JSON.stringify(data, null, 2),
            'application/json',
            parentId
        );
    }

    /**
     * バイナリファイルをアップロード
     */
    async uploadBinaryFile(fileName, data, mimeType, parentId) {
        return await this.uploadFile(fileName, data, mimeType, parentId);
    }

    /**
     * ファイルをDriveにアップロード
     */
    async uploadFile(fileName, data, mimeType, parentId) {
        try {
            this.log(`Uploading file: ${fileName} to parent: ${parentId}`);
            
            const metadata = {
                name: fileName,
                parents: [parentId]
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            
            if (data instanceof Uint8Array) {
                form.append('file', new Blob([data], {type: mimeType}));
            } else {
                form.append('file', new Blob([data], {type: mimeType}));
            }
            
            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    body: form
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const result = await response.json();
            this.log(`File uploaded successfully: ${fileName} (${result.id})`);
            return result;
            
        } catch (error) {
            this.error(`Failed to upload file ${fileName}:`, error);
            throw error;
        }
    }

    /**
     * プロジェクトフォルダを検索（デバッグ強化版）
     */
    async findProjectFolder(projectId) {
        try {
            this.log(`Finding project folder for: ${projectId}`);
            
            // キャッシュから取得
            if (this.projectFolderCache.has(projectId)) {
                const cachedId = this.projectFolderCache.get(projectId);
                this.log(`Using cached folder ID for project ${projectId}: ${cachedId}`);
                
                // キャッシュされたフォルダが実際に存在するか確認
                const exists = await this.verifyFolderExists(cachedId);
                if (exists) {
                    return cachedId;
                } else {
                    this.log(`Cached folder ${cachedId} no longer exists, removing from cache`);
                    this.projectFolderCache.delete(projectId);
                }
            }
            
            // 手動で全てのプロジェクトフォルダをリスト
            this.log('Listing all project folders...');
            const allFolders = await this.listAllProjectFolders();
            this.log('All project folders found:', allFolders);
            
            // フォルダ名のパターンを複数試す
            const patterns = [
                projectId, // プロジェクトIDのみ
                `_${projectId}` // アンダースコア + プロジェクトID
            ];
            
            for (const folder of allFolders) {
                for (const pattern of patterns) {
                    if (folder.name.includes(pattern)) {
                        this.log(`Found matching folder: ${folder.name} (${folder.id})`);
                        // キャッシュに保存
                        this.projectFolderCache.set(projectId, folder.id);
                        return folder.id;
                    }
                }
            }
            
            this.log(`No project folder found for ${projectId}`);
            return null;
            
        } catch (error) {
            this.error(`Failed to find project folder for ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * 全てのプロジェクトフォルダをリスト
     */
    async listAllProjectFolders() {
        try {
            if (!this.folderIds.projects) {
                await this.initializeFolderStructure();
            }
            
            const query = `'${this.folderIds.projects}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`List folders failed: ${response.status}`);
            }
            
            const result = await response.json();
            return result.files || [];
            
        } catch (error) {
            this.error('Failed to list project folders:', error);
            throw error;
        }
    }

    /**
     * フォルダの存在確認
     */
    async verifyFolderExists(folderId) {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${folderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );
            
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 共有リンクを生成（デバッグ強化版）
     */
    async createShareLink(projectId, permission = 'reader') {
        try {
            this.log(`Creating share link for project ${projectId}`);
            
            const projectFolderId = await this.findProjectFolder(projectId);
            
            if (!projectFolderId) {
                this.log('Project folder not found, attempting manual sync first...');
                
                // 手動で同期を試行
                const syncResult = await this.forceSyncProject(projectId);
                if (syncResult) {
                    // 再度検索
                    const retryFolderId = await this.findProjectFolder(projectId);
                    if (retryFolderId) {
                        this.log(`Project folder found after manual sync: ${retryFolderId}`);
                        return await this.doCreateShareLink(retryFolderId, permission);
                    }
                }
                
                throw new Error('プロジェクトフォルダが見つかりません。まず同期を実行してください。');
            }
            
            return await this.doCreateShareLink(projectFolderId, permission);
            
        } catch (error) {
            this.error('Failed to create share link:', error);
            throw error;
        }
    }

    /**
     * 実際の共有リンク作成処理
     */
    async doCreateShareLink(projectFolderId, permission) {
        this.log(`Creating share link for folder: ${projectFolderId}`);
        
        // 一般共有を設定
        const permissionData = {
            role: permission,
            type: 'anyone'
        };
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${projectFolderId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(permissionData)
            }
        );
        
        if (response.ok) {
            const shareLink = `https://drive.google.com/drive/folders/${projectFolderId}`;
            this.log(`Share link created: ${shareLink}`);
            return shareLink;
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to create share link: ${response.status} - ${errorText}`);
        }
    }

    /**
     * 特定プロジェクトの強制同期
     */
    async forceSyncProject(projectId) {
        try {
            this.log(`Force syncing project: ${projectId}`);
            
            // ローカルプロジェクトデータを取得
            const localData = await chrome.storage.local.get(['projects', 'screens']);
            const projects = localData.projects || [];
            const screens = localData.screens || [];
            
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                this.log(`Project ${projectId} not found locally`);
                return false;
            }
            
            const projectScreens = screens.filter(s => s.projectId === projectId);
            
            // 強制アップロード
            await this.uploadProject(project, projectScreens);
            this.log(`Force sync completed for project: ${project.name}`);
            return true;
            
        } catch (error) {
            this.error('Force sync failed:', error);
            return false;
        }
    }

    /**
     * 自動同期を実行（デバッグ強化版）
     */
    async performAutoSync() {
        try {
            if (this.syncInProgress) {
                this.log('Sync already in progress, aborting');
                return { success: false, message: '同期処理が既に進行中です' };
            }
            
            this.log('Starting auto sync...');
            
            // 初期化状態をチェック
            if (!this.folderIds.projects) {
                this.log('Folder structure not initialized, initializing now...');
                await this.initializeFolderStructure();
            }
            
            const syncItems = await this.checkSyncStatus();
            
            if (syncItems.length === 0) {
                this.log('No sync needed');
                return { success: true, message: '同期は最新です' };
            }
            
            this.log(`Found ${syncItems.length} items to sync`);
            const results = [];
            
            for (const item of syncItems) {
                try {
                    if (item.action === 'upload') {
                        this.log(`Syncing project: ${item.project.name}`);
                        
                        // ローカル→Driveにアップロード
                        const localData = await chrome.storage.local.get(['screens']);
                        const projectScreens = (localData.screens || [])
                            .filter(s => s.projectId === item.project.id);
                        
                        await this.uploadProject(item.project, projectScreens);
                        results.push({ 
                            project: item.project.name, 
                            action: 'uploaded', 
                            success: true 
                        });
                        
                    } else {
                        // Drive→ローカルにダウンロード
                        this.log(`Download needed for project: ${item.project.name}`);
                        results.push({ 
                            project: item.project.name, 
                            action: 'download_pending', 
                            success: true 
                        });
                    }
                } catch (error) {
                    this.error(`Sync failed for project ${item.project.name}:`, error);
                    results.push({ 
                        project: item.project.name, 
                        action: item.action, 
                        success: false, 
                        error: error.message 
                    });
                }
            }
            
            this.log('Auto sync completed:', results);
            return { 
                success: true, 
                message: `${results.filter(r => r.success).length}件の同期が完了しました`, 
                results 
            };
            
        } catch (error) {
            this.error('Auto sync failed:', error);
            return { 
                success: false, 
                message: '同期に失敗しました: ' + error.message 
            };
        }
    }

    /**
     * 同期状態をチェック
     */
    async checkSyncStatus() {
        try {
            // ローカルプロジェクトを取得
            const localData = await chrome.storage.local.get(['projects', 'screens']);
            const localProjects = localData.projects || [];
            
            // 簡単な同期チェック：全てのローカルプロジェクトをアップロード対象とする
            const syncNeeded = localProjects.map(project => ({
                action: 'upload',
                project: project
            }));
            
            this.log(`Sync check completed: ${syncNeeded.length} items need sync`);
            return syncNeeded;
            
        } catch (error) {
            this.error('Failed to check sync status:', error);
            throw error;
        }
    }

    /**
     * プロジェクト共有機能
     */
    async shareProject(projectId, emails, permission = 'reader') {
        try {
            this.log(`Sharing project ${projectId} with ${emails.length} users`);
            
            // プロジェクトフォルダを検索
            const projectFolderId = await this.findProjectFolder(projectId);
            
            if (!projectFolderId) {
                throw new Error('プロジェクトフォルダが見つかりません。まず同期を実行してください。');
            }
            
            // 各メールアドレスに権限を付与
            const shareResults = [];
            
            for (const email of emails) {
                try {
                    const permissionData = {
                        role: permission, // 'reader', 'writer', 'commenter'
                        type: 'user',
                        emailAddress: email.trim()
                    };
                    
                    const response = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${projectFolderId}/permissions`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${this.accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(permissionData)
                        }
                    );
                    
                    if (response.ok) {
                        const result = await response.json();
                        shareResults.push({ 
                            email: email.trim(), 
                            success: true, 
                            permissionId: result.id 
                        });
                        this.log(`Successfully shared with ${email}`);
                    } else {
                        const errorText = await response.text();
                        shareResults.push({ 
                            email: email.trim(), 
                            success: false, 
                            error: `${response.status}: ${errorText}` 
                        });
                    }
                    
                } catch (error) {
                    shareResults.push({ 
                        email: email.trim(), 
                        success: false, 
                        error: error.message 
                    });
                }
            }
            
            this.log('Share results:', shareResults);
            return shareResults;
            
        } catch (error) {
            this.error('Failed to share project:', error);
            throw error;
        }
    }

    // 以下、その他のメソッドは前回と同じ...
    
    /**
     * 認証状態をリセット
     */
    async signOut() {
        try {
            if (this.accessToken) {
                chrome.identity.removeCachedAuthToken(
                    { token: this.accessToken },
                    () => {
                        this.log('Auth token removed');
                    }
                );
            }
            
            this.isAuthenticated = false;
            this.accessToken = null;
            this.userInfo = null;
            this.folderIds = { root: null, projects: null, shared: null };
            this.projectFolderCache.clear();
            
            this.log('Signed out from Google Drive');
            
        } catch (error) {
            this.error('Sign out error:', error);
        }
    }
}

// グローバルインスタンス
window.driveManager = new DriveManager();

console.log('DriveManager (debug version) loaded successfully');