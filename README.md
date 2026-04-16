# Slaick

SlackのスレッドやチャンネルをAIで要約するSlackボットです。

## 機能

- **スレッド要約**: メッセージのショートカットからスレッドを要約
- **チャンネル要約**: チャンネルの最新メッセージをまとめて要約
- **Notionエクスポート**: 要約をNotionデータベースへエクスポート
- **Markdownエクスポート**: 要約をMarkdown形式で表示

## 必要な環境変数

`.env.example` をコピーして `.env` を作成し、各値を設定してください。

```
SLACK_SIGNING_SECRET=  # Slackアプリの署名シークレット
SLACK_BOT_TOKEN=       # SlackボットのOAuthトークン
SLACK_APP_TOKEN=       # SlackアプリレベルトークN（ソケットモード用）
OPENROUTER_API_KEY=    # OpenRouter APIキー
NOTION_API_KEY=        # Notion APIキー（Notionエクスポートを使う場合）
NOTION_DATABASE_ID=    # NotionデータベースID（Notionエクスポートを使う場合）
```

## 起動方法

```bash
pnpm install
pnpm start
```
