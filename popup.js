/**
 * ScreenSpec - Popup UI Controller with Google Drive Integration
 * プロジェクト管理機能付きの画面設計書作成ツール + Google Drive連携
 */

class ScreenSpecUI {
    constructor() {
        this.currentProject = null;
        this.projects = [];
        this.screens = [];
        this.editingProject = null;
        this.driveConnected = false;
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateUI();
            
            // Google Drive接続状態をチェック
            await this.initializeDriveFeatures();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('初期化エラーが発生しました', 'error');
        }
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get(['currentProject', 'projects', 'screens']);
            
            this.currentProject = result.currentProject || null;
            this.projects = result.projects || [];
            this.screens = result.screens || [];
            
            console.log('Loaded data:', { 
                currentProject: this.currentProject, 
                projects: this.projects.length, 
                screens: this.screens.length 
            });
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // キャプチャボタン
        document.getElementById('btnCaptureVisible')?.addEventListener('click', () => {
            this.captureScreen('visible');
        });

        document.getElementById('btnCaptureFull')?.addEventListener('click', () => {
            this.captureScreen('full');
        });

        // プロジェクト管理
        document.getElementById('btnManage')?.addEventListener('click', () => {
            this.openProjectModal();
        });

        document.getElementById('btnCloseModal')?.addEventListener('click', () => {
            this.closeProjectModal();
        });

        // プロジェクト作成
        document.getElementById('btnCreateProject')?.addEventListener('click', () => {
            this.createProject();
        });

        // プロジェクト検索
        document.getElementById('searchProjects')?.addEventListener('input', (e) => {
            this.filterProjects(e.target.value);
        });

        // プロジェクト編集モーダル
        document.getElementById('btnCloseEditModal')?.addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('btnSaveProject')?.addEventListener('click', () => {
            this.saveProject();
        });

        document.getElementById('btnDeleteProject')?.addEventListener('click', () => {
            this.showDeleteConfirm();
        });

        // 削除確認
        document.getElementById('btnCancelDelete')?.addEventListener('click', () => {
            this.closeDeleteConfirm();
        });

        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => {
            this.deleteProject();
        });

        // PDF出力
        document.getElementById('btnExport')?.addEventListener('click', () => {
            this.exportPDF();
        });

        // Google Drive機能
        document.getElementById('btnDriveConnect')?.addEventListener('click', () => {
            this.connectToDrive();
        });

        document.getElementById('btnSync')?.addEventListener('click', () => {
            this.syncWithDrive();
        });

        document.getElementById('btnShare')?.addEventListener('click', () => {
            this.openShareModal();
        });

        // 共有モーダル
        document.getElementById('btnCloseShareModal')?.addEventListener('click', () => {
            this.closeShareModal();
        });

        document.getElementById('btnCancelShare')?.addEventListener('click', () => {
            this.closeShareModal();
        });

        document.getElementById('btnConfirmShare')?.addEventListener('click', () => {
            this.confirmShare();
        });

        document.getElementById('btnCopyLink')?.addEventListener('click', () => {
            this.copyShareLink();
        });

        // モーダル外クリックで閉じる
        document.getElementById('projectModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'projectModal') {
                this.closeProjectModal();
            }
        });

        document.getElementById('editProjectModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'editProjectModal') {
                this.closeEditModal();
            }
        });

        document.getElementById('deleteConfirmModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'deleteConfirmModal') {
                this.closeDeleteConfirm();
            }
        });

        document.getElementById('shareModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') {
                this.closeShareModal();
            }
        });

        // Enterキーでプロジェクト作成
        document.getElementById('projectName')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createProject();
            }
        });

        // Escキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // =============================================
    // Google Drive連携機能
    // =============================================

    /**
     * Google Drive機能の初期化
     */
    async initializeDriveFeatures() {
        try {
            console.log('Initializing Drive features...');
            
            // 既存の認証をチェック
            await this.checkDriveConnection();
            
        } catch (error) {
            console.error('Drive features initialization failed:', error);
        }
    }

    /**
     * 既存のGoogle Drive接続をチェック
     */
    async checkDriveConnection() {
        try {
            if (window.driveManager) {
                const token = await window.driveManager.checkExistingAuth();
                
                if (token) {
                    window.driveManager.accessToken = token;
                    window.driveManager.isAuthenticated = true;
                    await window.driveManager.loadUserInfo();
                    this.driveConnected = true;
                    this.updateDriveUI(true);
                    console.log('Existing Drive connection found');
                } else {
                    this.updateDriveUI(false);
                }
            }
        } catch (error) {
            console.log('No existing auth token or error:', error);
            this.updateDriveUI(false);
        }
    }

    /**
     * Google Driveに接続
     */
    async connectToDrive() {
        try {
            this.showLoading(true);
            this.showNotification('Google Driveに接続中...', 'info');

            if (!window.driveManager) {
                throw new Error('DriveManagerが読み込まれていません');
            }

            const success = await window.driveManager.initialize();
            
            if (success) {
                this.driveConnected = true;
                this.showNotification(`Google Driveに接続しました！ (${window.driveManager.userInfo?.email})`, 'success');
                this.updateDriveUI(true);
                
                // 自動同期を実行
                setTimeout(() => {
                    this.syncWithDrive();
                }, 1000);
            } else {
                throw new Error('接続に失敗しました');
            }
            
        } catch (error) {
            console.error('Drive connection failed:', error);
            this.showNotification('Google Drive接続に失敗しました: ' + error.message, 'error');
            this.updateDriveUI(false);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Google Driveと同期
     */
    async syncWithDrive() {
        if (!this.driveConnected || !window.driveManager?.isAuthenticated) {
            this.showNotification('最初にGoogle Driveに接続してください', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            this.showNotification('同期中...', 'info');

            const result = await window.driveManager.performAutoSync();
            
            if (result.success) {
                this.showNotification(result.message, 'success');
                
                // 同期後にローカルデータを再読み込み
                await this.loadData();
                this.updateUI();
                this.updateSyncInfo('同期完了');
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            console.error('Sync failed:', error);
            this.showNotification('同期に失敗しました: ' + error.message, 'error');
            this.updateSyncInfo('同期エラー');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 共有モーダルを開く
     */
    async openShareModal() {
        if (!this.currentProject) {
            this.showNotification('共有するプロジェクトを選択してください', 'warning');
            return;
        }

        if (!this.driveConnected || !window.driveManager?.isAuthenticated) {
            this.showNotification('最初にGoogle Driveに接続してください', 'warning');
            return;
        }

        try {
            this.showModal('shareModal');
            this.showNotification('共有リンクを生成中...', 'info');
            
            // 共有リンクを生成
            const shareLink = await window.driveManager.createShareLink(this.currentProject.id, 'reader');
            
            const shareLinkInput = document.getElementById('shareLink');
            if (shareLinkInput) {
                shareLinkInput.value = shareLink;
            }
            
            this.showNotification('共有リンクを生成しました', 'success');
            
        } catch (error) {
            console.error('Failed to create share link:', error);
            this.showNotification('共有リンクの生成に失敗しました: ' + error.message, 'error');
        }
    }

    /**
     * 共有モーダルを閉じる
     */
    closeShareModal() {
        this.hideModal('shareModal');
        
        // フォームをリセット
        const shareEmailsTextarea = document.getElementById('shareEmails');
        const sharePermissionSelect = document.getElementById('sharePermission');
        const shareLinkInput = document.getElementById('shareLink');
        
        if (shareEmailsTextarea) shareEmailsTextarea.value = '';
        if (sharePermissionSelect) sharePermissionSelect.value = 'reader';
        if (shareLinkInput) shareLinkInput.value = '';
    }

    /**
     * 共有を実行
     */
    async confirmShare() {
        try {
            const shareEmailsTextarea = document.getElementById('shareEmails');
            const sharePermissionSelect = document.getElementById('sharePermission');
            
            if (!shareEmailsTextarea || !sharePermissionSelect) {
                throw new Error('共有フォーム要素が見つかりません');
            }

            const emailsText = shareEmailsTextarea.value.trim();
            const permission = sharePermissionSelect.value;

            if (!emailsText) {
                this.showNotification('メールアドレスを入力してください', 'warning');
                return;
            }

            // メールアドレスを改行で分割して整理
            const emails = emailsText
                .split(/[\n,]/)
                .map(email => email.trim())
                .filter(email => email.length > 0);

            if (emails.length === 0) {
                this.showNotification('有効なメールアドレスを入力してください', 'warning');
                return;
            }

            this.showLoading(true);
            this.showNotification(`${emails.length}名にプロジェクトを共有中...`, 'info');

            const shareResults = await window.driveManager.shareProject(
                this.currentProject.id,
                emails,
                permission
            );

            // 結果を確認
            const successCount = shareResults.filter(r => r.success).length;
            const failureCount = shareResults.filter(r => !r.success).length;

            if (successCount > 0) {
                this.showNotification(
                    `${successCount}名への共有が完了しました${failureCount > 0 ? ` (${failureCount}名は失敗)` : ''}`,
                    failureCount > 0 ? 'warning' : 'success'
                );
            } else {
                this.showNotification('共有に失敗しました', 'error');
            }

            // 失敗したメールアドレスがあれば表示
            const failedEmails = shareResults
                .filter(r => !r.success)
                .map(r => `${r.email}: ${r.error}`)
                .join('\n');

            if (failedEmails) {
                console.error('Share failures:', failedEmails);
            }

            this.closeShareModal();
            
        } catch (error) {
            console.error('Share failed:', error);
            this.showNotification('共有に失敗しました: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 共有リンクをコピー
     */
    async copyShareLink() {
        try {
            const shareLinkInput = document.getElementById('shareLink');
            if (!shareLinkInput || !shareLinkInput.value) {
                this.showNotification('共有リンクがありません', 'warning');
                return;
            }

            await navigator.clipboard.writeText(shareLinkInput.value);
            this.showNotification('共有リンクをコピーしました', 'success');
            
        } catch (error) {
            console.error('Failed to copy link:', error);
            
            // フォールバック: 手動選択
            const shareLinkInput = document.getElementById('shareLink');
            if (shareLinkInput) {
                shareLinkInput.select();
                shareLinkInput.setSelectionRange(0, 99999);
                this.showNotification('リンクを選択しました。Ctrl+Cでコピーしてください', 'info');
            }
        }
    }

    /**
     * Drive UI状態を更新
     */
    updateDriveUI(connected) {
        const driveStatus = document.getElementById('driveStatus');
        const connectBtn = document.getElementById('btnDriveConnect');
        const syncBtn = document.getElementById('btnSync');
        const shareBtn = document.getElementById('btnShare');

        if (connected) {
            // 接続済み状態
            if (driveStatus) {
                driveStatus.textContent = '接続済み';
                driveStatus.className = 'drive-status connected';
            }
            
            if (connectBtn) {
                connectBtn.innerHTML = '<span>✅</span><span>接続済み</span>';
                connectBtn.disabled = true;
            }
            
            if (syncBtn) syncBtn.disabled = false;
            if (shareBtn) shareBtn.disabled = false;
            
            this.updateSyncInfo(
                window.driveManager?.userInfo?.email 
                    ? `${window.driveManager.userInfo.email} でログイン中`
                    : '同期準備完了'
            );
        } else {
            // 未接続状態
            if (driveStatus) {
                driveStatus.textContent = '未接続';
                driveStatus.className = 'drive-status disconnected';
            }
            
            if (connectBtn) {
                connectBtn.innerHTML = '<span>🔗</span><span>Drive接続</span>';
                connectBtn.disabled = false;
            }
            
            if (syncBtn) syncBtn.disabled = true;
            if (shareBtn) shareBtn.disabled = true;
            
            this.updateSyncInfo('Google Driveに接続してチーム共有を開始');
        }
    }

    /**
     * 同期情報を更新
     */
    updateSyncInfo(message) {
        const syncInfo = document.getElementById('syncInfo');
        if (syncInfo) {
            syncInfo.textContent = message;
        }
    }

    // =============================================
    // 既存の機能（変更なし）
    // =============================================

    async captureScreen(type) {
        try {
            if (!this.currentProject) {
                this.showNotification('プロジェクトを選択してください', 'warning');
                this.openProjectModal();
                return;
            }

            this.showLoading(true);
            this.showNotification('キャプチャ中...', 'info');

            // バックグラウンドスクリプトにキャプチャ要求を送信
            const response = await chrome.runtime.sendMessage({
                action: 'captureScreen',
                type: type,
                projectId: this.currentProject.id
            });

            if (response && response.success) {
                await this.loadData();
                this.updateScreensList();
                this.updateCurrentProjectDisplay();
                this.showNotification(`${type === 'visible' ? '表示部分' : 'ページ全体'}のキャプチャが完了しました`);
                
                // キャプチャ後に自動同期（Drive接続時）
                if (this.driveConnected && window.driveManager?.isAuthenticated) {
                    setTimeout(() => {
                        this.syncWithDrive();
                    }, 1000);
                }
            } else {
                throw new Error(response?.error || 'キャプチャに失敗しました');
            }
        } catch (error) {
            console.error('Capture error:', error);
            this.showNotification('キャプチャエラー: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openProjectModal() {
        this.updateProjectsList();
        this.showModal('projectModal');
        // フォーカスを設定
        setTimeout(() => {
            document.getElementById('projectName')?.focus();
        }, 100);
    }

    closeProjectModal() {
        this.hideModal('projectModal');
        this.clearProjectForm();
    }

    async createProject() {
        const name = document.getElementById('projectName')?.value.trim();
        const description = document.getElementById('projectDescription')?.value.trim();

        if (!name) {
            this.showNotification('プロジェクト名を入力してください', 'warning');
            document.getElementById('projectName')?.focus();
            return;
        }

        // 同名プロジェクトのチェック
        if (this.projects.some(p => p.name === name)) {
            this.showNotification('同じ名前のプロジェクトが既に存在します', 'warning');
            document.getElementById('projectName')?.focus();
            return;
        }

        try {
            const project = {
                id: Date.now().toString(),
                name: name,
                description: description,
                color: this.generateRandomColor(),
                createdAt: new Date().toISOString(),
                screenCount: 0
            };

            this.projects.push(project);
            await this.saveProjects();

            // 作成したプロジェクトを現在のプロジェクトに設定
            await this.setCurrentProject(project);

            this.clearProjectForm();
            this.updateProjectsList();
            this.closeProjectModal();
            this.showNotification(`プロジェクト「${name}」を作成しました`);
            
            // プロジェクト作成後に自動同期（Drive接続時）
            if (this.driveConnected && window.driveManager?.isAuthenticated) {
                setTimeout(() => {
                    this.syncWithDrive();
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            this.showNotification('プロジェクト作成に失敗しました', 'error');
        }
    }

    async setCurrentProject(project) {
        try {
            this.currentProject = project;
            await chrome.storage.local.set({ currentProject: project });
            this.updateCurrentProjectDisplay();
            await this.loadData();
            this.updateScreensList();
        } catch (error) {
            console.error('Failed to set current project:', error);
            throw error;
        }
    }

    clearProjectForm() {
        const projectName = document.getElementById('projectName');
        const projectDescription = document.getElementById('projectDescription');
        
        if (projectName) projectName.value = '';
        if (projectDescription) projectDescription.value = '';
    }

    updateProjectsList() {
        const container = document.getElementById('projectsContainer');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>プロジェクトがありません</p>
                    <p class="empty-hint">新しいプロジェクトを作成してください</p>
                </div>
            `;
            return;
        }

        // プロジェクトを作成日順でソート（新しい順）
        const sortedProjects = [...this.projects].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        container.innerHTML = sortedProjects.map(project => `
            <div class="project-card ${this.currentProject?.id === project.id ? 'active' : ''}" 
                 data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <div class="project-name">${this.escapeHtml(project.name)}</div>
                        <div class="project-description">${this.escapeHtml(project.description || '')}</div>
                    </div>
                    <div class="project-color" style="background-color: ${project.color}"></div>
                </div>
                <div class="project-meta">
                    <span>${project.screenCount || 0} 画面</span>
                    <span class="project-date">${this.formatDate(project.createdAt)}</span>
                    <div class="project-actions">
                        <button class="btn-edit" data-project-id="${project.id}" data-action="edit" title="編集">
                            ✏️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // プロジェクトカードのクリックイベント
        container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                if (e.target.dataset.action === 'edit') {
                    e.stopPropagation();
                    const projectId = e.target.dataset.projectId;
                    this.editProject(projectId);
                    return;
                }

                const projectId = card.dataset.projectId;
                const project = this.projects.find(p => p.id === projectId);
                if (project) {
                    await this.setCurrentProject(project);
                    this.updateProjectsList();
                    this.showNotification(`プロジェクト「${project.name}」を選択しました`);
                }
            });
        });
    }

    filterProjects(searchTerm) {
        const cards = document.querySelectorAll('.project-card');
        const term = searchTerm.toLowerCase();

        cards.forEach(card => {
            const name = card.querySelector('.project-name')?.textContent.toLowerCase() || '';
            const description = card.querySelector('.project-description')?.textContent.toLowerCase() || '';
            
            if (name.includes(term) || description.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.editingProject = project;
        
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectDescription').value = project.description || '';
        
        this.showModal('editProjectModal');
        
        // フォーカスを設定
        setTimeout(() => {
            document.getElementById('editProjectName')?.focus();
        }, 100);
    }

    closeEditModal() {
        this.hideModal('editProjectModal');
        this.editingProject = null;
    }

    async saveProject() {
        if (!this.editingProject) return;

        const name = document.getElementById('editProjectName')?.value.trim();
        const description = document.getElementById('editProjectDescription')?.value.trim();

        if (!name) {
            this.showNotification('プロジェクト名を入力してください', 'warning');
            document.getElementById('editProjectName')?.focus();
            return;
        }

        // 同名プロジェクトのチェック（自分以外）
        if (this.projects.some(p => p.name === name && p.id !== this.editingProject.id)) {
            this.showNotification('同じ名前のプロジェクトが既に存在します', 'warning');
            document.getElementById('editProjectName')?.focus();
            return;
        }

        try {
            const oldName = this.editingProject.name;
            this.editingProject.name = name;
            this.editingProject.description = description;

            await this.saveProjects();

            if (this.currentProject?.id === this.editingProject.id) {
                this.currentProject = this.editingProject;
                await chrome.storage.local.set({ currentProject: this.currentProject });
                this.updateCurrentProjectDisplay();
            }

            this.updateProjectsList();
            this.closeEditModal();
            this.showNotification(`プロジェクト「${oldName}」を「${name}」に更新しました`);
        } catch (error) {
            console.error('Failed to save project:', error);
            this.showNotification('プロジェクトの更新に失敗しました', 'error');
        }
    }

    showDeleteConfirm() {
        if (!this.editingProject) return;
        
        // 削除確認メッセージを更新
        const confirmMessage = document.getElementById('deleteConfirmMessage');
        if (confirmMessage) {
            const screenCount = this.screens.filter(s => s.projectId === this.editingProject.id).length;
            confirmMessage.innerHTML = `
                プロジェクト「<strong>${this.escapeHtml(this.editingProject.name)}</strong>」を削除しますか？<br>
                <small class="text-warning">${screenCount}個のキャプチャも同時に削除されます。</small>
            `;
        }
        
        this.showModal('deleteConfirmModal');
    }

    closeDeleteConfirm() {
        this.hideModal('deleteConfirmModal');
    }

    async deleteProject() {
        if (!this.editingProject) return;

        try {
            const deletedName = this.editingProject.name;
            
            // プロジェクトを削除
            this.projects = this.projects.filter(p => p.id !== this.editingProject.id);
            
            // 関連するスクリーンを削除
            const deletedScreenCount = this.screens.filter(s => s.projectId === this.editingProject.id).length;
            this.screens = this.screens.filter(s => s.projectId !== this.editingProject.id);
            
            // 現在のプロジェクトの場合は解除
            if (this.currentProject?.id === this.editingProject.id) {
                this.currentProject = null;
                await chrome.storage.local.set({ currentProject: null });
            }

            await this.saveData();
            
            this.updateProjectsList();
            this.updateCurrentProjectDisplay();
            this.updateScreensList();
            
            this.closeDeleteConfirm();
            this.closeEditModal();
            
            this.showNotification(`プロジェクト「${deletedName}」と${deletedScreenCount}個のキャプチャを削除しました`);
        } catch (error) {
            console.error('Failed to delete project:', error);
            this.showNotification('プロジェクトの削除に失敗しました', 'error');
        }
    }

    async saveData() {
        await chrome.storage.local.set({
            projects: this.projects,
            screens: this.screens
        });
    }

    async saveProjects() {
        await chrome.storage.local.set({ projects: this.projects });
    }

    updateUI() {
        this.updateCurrentProjectDisplay();
        this.updateScreensList();
    }

    updateCurrentProjectDisplay() {
        const currentProjectElement = document.getElementById('currentProject');
        const projectMetaElement = document.getElementById('projectMeta');
        
        if (currentProjectElement) {
            if (this.currentProject) {
                currentProjectElement.textContent = this.currentProject.name;
                currentProjectElement.style.color = this.currentProject.color;
                
                if (projectMetaElement) {
                    const screenCount = this.screens.filter(s => s.projectId === this.currentProject.id).length;
                    projectMetaElement.textContent = `${screenCount} 画面 • ${this.formatDate(this.currentProject.createdAt)}`;
                }
            } else {
                currentProjectElement.textContent = 'プロジェクト未選択';
                currentProjectElement.style.color = '#7f8c8d';
                
                if (projectMetaElement) {
                    projectMetaElement.textContent = 'プロジェクトを選択または作成してください';
                }
            }
        }
    }

    updateScreensList() {
        const screensListElement = document.getElementById('screensList');
        const exportButton = document.getElementById('btnExport');
        
        if (!screensListElement) return;

        // 現在のプロジェクトのスクリーンをフィルタ
        const projectScreens = this.currentProject 
            ? this.screens.filter(screen => screen.projectId === this.currentProject.id)
            : [];

        // 作成日順でソート（新しい順）
        projectScreens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // エクスポートボタンの状態を更新
        if (exportButton) {
            exportButton.disabled = projectScreens.length === 0;
            exportButton.title = projectScreens.length === 0 ? 'キャプチャがありません' : 'PDFとして出力';
        }

        if (projectScreens.length === 0) {
            screensListElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📷</div>
                    <p>まだキャプチャがありません</p>
                    <p class="empty-hint">上のボタンからキャプチャを開始してください</p>
                </div>
            `;
            return;
        }

        screensListElement.innerHTML = projectScreens.map((screen, index) => `
            <div class="screen-item" data-screen-id="${screen.id}">
                <img src="${screen.thumbnail}" alt="画面キャプチャ" class="screen-thumbnail" loading="lazy">
                <div class="screen-info">
                    <div class="screen-title">${this.escapeHtml(screen.title || '無題')}</div>
                    <div class="screen-meta">
                        <span>${this.formatDate(screen.createdAt)}</span>
                        <span class="screen-type">${screen.type === 'visible' ? '表示部分' : 'ページ全体'}</span>
                    </div>
                    <div class="screen-url" title="${this.escapeHtml(screen.url)}">
                        ${this.truncateUrl(screen.url)}
                    </div>
                </div>
                <div class="screen-actions">
                    <button class="btn-action btn-annotate" data-action="annotate" data-screen-id="${screen.id}" title="注釈を編集">
                        ✏️
                    </button>
                    <button class="btn-action btn-preview" data-action="preview" data-screen-id="${screen.id}" title="プレビュー">
                        👁️
                    </button>
                    <button class="btn-action btn-delete" data-action="delete" data-screen-id="${screen.id}" title="削除">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        // スクリーンアクションのイベントリスナー
        screensListElement.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteScreen(btn.dataset.screenId);
            });
        });

        // 注釈ボタンのイベントリスナー
        screensListElement.querySelectorAll('[data-action="annotate"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAnnotationEditor(btn.dataset.screenId);
            });
        });

        // プレビューボタンのイベントリスナー
        screensListElement.querySelectorAll('[data-action="preview"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.previewScreen(btn.dataset.screenId);
            });
        });

        // 画像クリックでプレビュー
        screensListElement.querySelectorAll('.screen-thumbnail').forEach(img => {
            img.addEventListener('click', (e) => {
                const screenId = e.target.closest('.screen-item').dataset.screenId;
                this.previewScreen(screenId);
            });
        });
    }

    async openAnnotationEditor(screenId) {
        try {
            const screen = this.screens.find(s => s.id === screenId);
            if (!screen) {
                this.showNotification('画面が見つかりません', 'error');
                return;
            }

            // 新しいタブで注釈エディターを開く
            const annotationUrl = chrome.runtime.getURL('annotation.html') + `?screenId=${screenId}`;
            await chrome.tabs.create({ url: annotationUrl });
            
            // ポップアップを閉じる
            window.close();
        } catch (error) {
            console.error('Failed to open annotation editor:', error);
            this.showNotification('注釈エディターの起動に失敗しました', 'error');
        }
    }

    previewScreen(screenId) {
        const screen = this.screens.find(s => s.id === screenId);
        if (!screen) {
            this.showNotification('画面が見つかりません', 'error');
            return;
        }

        // 新しいタブで画像を開く
        const newTab = window.open();
        newTab.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${screen.title} - ScreenSpec</title>
                <style>
                    body { margin: 0; padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                    .meta { color: #666; font-size: 14px; }
                    .image-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
                    img { max-width: 100%; height: auto; border: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="title">${this.escapeHtml(screen.title)}</div>
                        <div class="meta">
                            <div>URL: ${this.escapeHtml(screen.url)}</div>
                            <div>作成日: ${this.formatDate(screen.createdAt)}</div>
                            <div>タイプ: ${screen.type === 'visible' ? '表示部分' : 'ページ全体'}</div>
                        </div>
                    </div>
                    <div class="image-container">
                        <img src="${screen.dataUrl}" alt="${this.escapeHtml(screen.title)}">
                    </div>
                </div>
            </body>
            </html>
        `);
    }

    async deleteScreen(screenId) {
        const screen = this.screens.find(s => s.id === screenId);
        if (!screen) return;

        if (!confirm(`「${screen.title}」を削除しますか？`)) return;

        try {
            this.screens = this.screens.filter(s => s.id !== screenId);
            await chrome.storage.local.set({ screens: this.screens });
            
            // プロジェクトのスクリーン数を更新
            if (this.currentProject) {
                const project = this.projects.find(p => p.id === this.currentProject.id);
                if (project) {
                    project.screenCount = this.screens.filter(s => s.projectId === this.currentProject.id).length;
                    await this.saveProjects();
                    this.currentProject.screenCount = project.screenCount;
                }
            }
            
            this.updateScreensList();
            this.updateProjectsList();
            this.showNotification('キャプチャを削除しました');
        } catch (error) {
            console.error('Failed to delete screen:', error);
            this.showNotification('キャプチャの削除に失敗しました', 'error');
        }
    }

    async exportPDF() {
        if (!this.currentProject) {
            this.showNotification('プロジェクトを選択してください', 'warning');
            return;
        }

        const projectScreens = this.screens.filter(screen => screen.projectId === this.currentProject.id);
        if (projectScreens.length === 0) {
            this.showNotification('キャプチャがありません', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            this.showNotification('PDF出力中...', 'info');
            
            // 現在のプロジェクトにスクリーン数を更新
            const currentProject = { ...this.currentProject };
            currentProject.screenCount = projectScreens.length;
            
            const response = await chrome.runtime.sendMessage({
                action: 'exportPDF',
                project: currentProject,
                screens: projectScreens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            });

            if (response && response.success) {
                this.showNotification(`PDF「${response.filename}」を出力しました`);
            } else {
                throw new Error(response?.error || 'PDF出力に失敗しました');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('PDF出力エラー: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    closeAllModals() {
        this.hideModal('projectModal');
        this.hideModal('editProjectModal');
        this.hideModal('deleteConfirmModal');
        this.hideModal('shareModal');
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE',
            '#AED6F1', '#A9DFBF', '#F9E79F', '#D7DBDD', '#FADBD8'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // フォーカストラップの設定
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        // 自動で隠す時間を調整
        const timeout = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (notification.style.display === 'block') {
                notification.style.display = 'none';
            }
        }, timeout);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    truncateUrl(url, maxLength = 50) {
        if (!url || url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('ScreenSpec UI with Drive integration initializing...');
    new ScreenSpecUI();
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});