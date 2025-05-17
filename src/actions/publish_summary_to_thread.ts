import { App } from "@slack/bolt";
import { postSummaryToThread } from "../services/slack";

export const actionPublishSummaryToThread = async (app: App) => {
  app.action(
    "publish_summary_to_thread",
    async ({ ack, body, client, respond }) => {
      await ack();

      try {
        // bodyがBlockActionPayloadであることを確認
        if (
          !("actions" in body) ||
          !body.actions ||
          body.actions.length === 0
        ) {
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

        // スレッドに公開として投稿
        await postSummaryToThread(
          client,
          channelId,
          threadTs,
          summary,
          "public"
        );

        // 確認メッセージを送信
        if (body.channel?.id && "message" in body && body.message?.ts) {
          await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: "✅ 要約をスレッドに公開しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "✅ 要約をスレッドに公開しました",
                },
              },
            ],
          });
        } else {
          // エフェメラルメッセージで通知 (元のメッセージを更新できない場合)
          await respond({
            text: "✅ 要約をスレッドに公開しました",
            replace_original: false,
            response_type: "ephemeral",
          });
        }
      } catch (error) {
        console.error("要約公開エラー:", error);
        if ("respond" in body && typeof respond === "function") {
          await respond({
            text: `エラーが発生しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
            response_type: "ephemeral",
            replace_original: false,
          });
        }
      }
    }
  );
};
