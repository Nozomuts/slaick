# Slaick

SlackのスレッドやチャンネルをAIで要約し、Notionにエクスポートできるボットです。

## 機能

- **スレッド要約**: Slackのスレッドをショートカットから要約
- **チャンネル要約**: チャンネルの最新メッセージを要約
- **Notionエクスポート**: 要約をNotionデータベースにエクスポート
- **Markdownエクスポート**: 要約をMarkdown形式で表示

## 必要な環境変数

`.env.example` を参考に `.env` ファイルを作成してください。

| 変数名 | 説明 |
| --- | --- |
| `SLACK_SIGNING_SECRET` | Slack アプリの Signing Secret |
| `SLACK_BOT_TOKEN` | Slack ボットトークン |
| `SLACK_APP_TOKEN` | Slack アプリトークン（Socket Mode用） |
| `OPENROUTER_API_KEY` | OpenRouter API キー |
| `NOTION_API_KEY` | Notion API キー |
| `NOTION_DATABASE_ID` | エクスポート先の Notion データベース ID |

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# 起動
pnpm start
```
