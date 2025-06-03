# 📋 ScreenSpec

> Webアプリやモバイルアプリの画面設計書を効率よく作成・共有するChrome拡張機能

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/yourusername/screenspec-extension)

## 🎯 概要

ScreenSpecは、Webページのキャプチャに注釈を付けて、プロフェッショナルなUI設計書を素早く作成できるツールです。デザイナー、エンジニア、プロダクトマネージャーの間での仕様共有を効率化します。

### ✨ 主な機能

- 🖼️ **画面キャプチャ**: 表示部分またはページ全体をキャプチャ
- 📝 **注釈機能**: テキスト、矢印、枠線での注釈追加
- 💾 **自動保存**: ローカルストレージでの安全な保存
- 📄 **PDF出力**: プロフェッショナルな設計書として出力
- 🗂️ **プロジェクト管理**: 複数画面をまとめて管理

## 🚀 インストール

### 開発版（推奨）

1. このリポジトリをクローン
```bash
git clone https://github.com/yourusername/screenspec-extension.git
cd screenspec-extension
```

2. 必要なライブラリをダウンロード
```bash
# libsディレクトリを作成
mkdir libs
cd libs

# html2canvasをダウンロード
curl -o html2canvas.min.js https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js

# jsPDFをダウンロード
curl -o jspdf.min.js https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
```

3. Chromeに拡張機能を読み込み
   - Chrome で `chrome://extensions/` を開く
   - 「デベロッパーモード」をON
   - 「パッケージ化されていない拡張機能を読み込む」でプロジェクトフォルダを選択

## 📖 使い方

### 基本的な使い方

1. **キャプチャ**
   - 対象のWebページを開く
   - ScreenSpecアイコンをクリック
   - 「表示部分をキャプチャ」または「ページ全体をキャプチャ」を選択

2. **注釈追加**
   - キャプチャ後、注釈モードが自動で開始
   - テキスト注釈、矢印、枠線を追加
   - 必要に応じてメタ情報（画面名、機能名など）を入力

3. **書き出し**
   - 複数のキャプチャを設計書としてまとめる
   - PDF形式またはMarkdown形式で出力

### ショートカット

- `Esc` - 注釈モードを終了
- `Ctrl + S` - 注釈を保存（注釈モード中）

## 🛠️ 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **キャプチャ**: html2canvas
- **PDF生成**: jsPDF
- **ストレージ**: Chrome Storage API
- **アーキテクチャ**: Chrome Extension Manifest v3

## 📁 プロジェクト構造

```
screenspec-extension/
├── manifest.json           # 拡張機能設定
├── popup.html             # メインUI
├── popup.js               # UI動作
├── background.js          # バックグラウンド処理
├── content.js             # ページ内動作
├── styles/
│   └── popup.css         # スタイルシート
├── libs/                 # 外部ライブラリ
└── icons/               # アイコンファイル
```

## 🔧 開発

### 前提条件

- Google Chrome (最新版)
- Git

### 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/screenspec-extension.git
cd screenspec-extension

# 開発用ブランチを作成
git checkout -b feature/your-feature-name
```

### デバッグ

1. Chrome DevToolsでBackground Scriptをデバッグ
   - `chrome://extensions/` → ScreenSpec → 「背景ページ」をクリック

2. Content Scriptのデバッグ
   - 対象ページでF12 → Consoleタブ

3. Popup UIのデバッグ
   - ポップアップを右クリック → 「検証」

## 🎯 ロードマップ

### v1.1.0 (予定)
- [ ] 矢印・枠線・ハイライト注釈
- [ ] 注釈の編集・削除機能
- [ ] カラーパレットとスタイル選択

### v1.2.0 (予定)
- [ ] PDF出力の高度なテンプレート
- [ ] Markdown/HTML出力
- [ ] 設計書のテンプレート機能

### v2.0.0 (将来)
- [ ] Google Drive連携
- [ ] チーム共有機能
- [ ] AI による UI要素自動検出

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### 開発ガイドライン

- ES6+ の記法を使用
- コメントは日本語で記述
- 機能追加時は適切なエラーハンドリングを実装

## 📝 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 👥 作成者

- **Your Name** - 初期開発 - [GitHub](https://github.com/yourusername)

## 🙏 謝辞

- [html2canvas](https://html2canvas.hertzen.com/) - 高品質なWebページキャプチャ
- [jsPDF](https://github.com/parallax/jsPDF) - クライアントサイドPDF生成
- Chrome Extension API - 拡張機能開発基盤

---

## 📞 サポート

問題や質問がある場合は、[Issues](https://github.com/yourusername/screenspec-extension/issues) ページで報告してください。

**🎨 より良いUI設計書作成のために！**