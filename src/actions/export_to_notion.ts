import { App } from "@slack/bolt";
import { exportToNotion } from "../services/notion";

export const actionExportToNotion = async (app: App) => {
  app.action("export_to_notion", async ({ ack, body, client, respond }) => {
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

      // チャンネル名を取得（タイトルに使用）
      const channelInfo = await client.conversations.info({
        channel: channelId,
      });
      const channelName = channelInfo.channel?.name || "チャンネル";

      // スレッドの最初のメッセージを取得してタイトルに使用
      const threadMessages = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 1,
      });

      const firstMessageText = threadMessages.messages?.[0]?.text || "";
      const shortText =
        firstMessageText.length > 30
          ? firstMessageText.substring(0, 30) + "..."
          : firstMessageText;

      // タイトルを作成
      const title = `${channelName} スレッド要約: ${shortText}`;

      // Notionにエクスポート
      const result = await exportToNotion(summary, { title });

      if (body.channel?.id) {
        if (result.success) {
          // 成功メッセージ
          await client.chat.update({
            channel: body.channel.id,
            ts: String(Date.now() / 1000),
            text: "✅ Notionへのエクスポートが完了しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "✅ Notionへのエクスポートが完了しました",
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `<${result.url}|Notionで開く>`,
                },
              },
            ],
          });
        } else {
          // エラーメッセージ
          await client.chat.update({
            channel: body.channel.id,
            ts: String(Date.now() / 1000),
            text: "❌ Notionへのエクスポートに失敗しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `❌ Notionへのエクスポートに失敗しました: ${result.error}`,
                },
              },
            ],
          });
        }
      } else {
        await respond({
          text: result.success
            ? `✅ Notionへのエクスポートが完了しました: <${result.url}|Notionで開く>`
            : `❌ Notionへのエクスポートに失敗しました: ${result.error}`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    } catch (error) {
      console.error("Notionエクスポートエラー:", error);
      if (body.channel?.id && "message" in body && body.message?.ts) {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      } else if ("respond" in body && typeof respond === "function") {
        await respond({
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    }
  });
};
