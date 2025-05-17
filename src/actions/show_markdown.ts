import { App } from "@slack/bolt";
import { generateMarkdown } from "../services/markdown";
import { uploadMarkdownFile } from "../services/slack";

export const actionShowMarkdown = async (app: App) => {
  app.action("show_markdown", async ({ ack, body, client, respond }) => {
    await ack();

    try {
      // bodyがBlockActionPayloadであることを確認
      if (!("actions" in body) || !body.actions || body.actions.length === 0) {
        throw new Error("アクションデータが見つかりません");
      }
      const action = body.actions[0];
      if (action.type !== "button" || !action.value) {
        throw new Error("要約データが見つかりません");
      }
      const value = action.value;

      // 値からチャンネルID、スレッドTS、要約テキストを取得
      const [channelId, threadTs, encodedSummary] = value.split(":");
      const summary = decodeURIComponent(encodedSummary);

      // マークダウンを生成
      const markdown = await generateMarkdown(
        client,
        channelId,
        threadTs,
        summary
      );

      // チャンネル名を取得（ファイル名に使用）
      const channelInfo = await client.conversations.info({
        channel: channelId,
      });
      const channelName = channelInfo.channel?.name || "channel";

      // 日付を取得（ファイル名に使用）
      const now = new Date();
      const dateStr = now.toISOString().substring(0, 10).replace(/-/g, "");

      // ファイル名を作成
      const fileName = `${channelName}_thread_summary_${dateStr}.md`;

      // マークダウンファイルをSlackにアップロード
      const fileUrl = await uploadMarkdownFile(
        client,
        body.channel?.id || channelId,
        markdown,
        fileName,
        "スレッド要約"
      );

      // マークダウンをコードブロックとして表示し、ダウンロードリンクを提供
      if (body.channel?.id) {
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
          text: "📝 Markdown形式の要約",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "📝 *Markdown形式の要約*\n\nマークダウンファイルが作成されました。以下のリンクからダウンロードできます。",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `<${fileUrl}|${fileName} をダウンロード>`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "プレビュー:\n```markdown\n" +
                  markdown.substring(0, 500) +
                  (markdown.length > 500 ? "...\n(省略)" : "") +
                  "\n```",
              },
            },
            {
              type: "actions",
              block_id: "markdown_actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "元の画面に戻る",
                    emoji: true,
                  },
                  value: `${channelId}:${threadTs}:${encodeURIComponent(
                    summary
                  )}`,
                  action_id: "back_to_summary",
                },
              ],
            },
          ],
        });
      } else {
        await respond({
          text: `📝 Markdown形式の要約\n<${fileUrl}|${fileName} をダウンロード>`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    } catch (error) {
      console.error("Markdown表示エラー:", error);
      if (body.channel?.id) {
        await client.chat.update({
          channel: body.channel.id,
          ts: (body as any).message.ts,
          text: "❌ Markdown表示に失敗しました",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `❌ Markdown表示に失敗しました: ${
                  error instanceof Error ? error.message : "不明なエラー"
                }`,
              },
            },
            {
              type: "actions",
              block_id: "markdown_error_actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "元の画面に戻る",
                    emoji: true,
                  },
                  value:
                    "actions" in body &&
                    body.actions &&
                    body.actions.length > 0 &&
                    body.actions[0].type === "button"
                      ? body.actions[0].value
                      : undefined,
                  action_id: "back_to_summary",
                },
              ],
            },
          ],
        });
      } else if ("respond" in body && typeof respond === "function") {
        await respond({
          text: `❌ Markdown表示に失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    }
  });
};
