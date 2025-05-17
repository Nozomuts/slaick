import { App, BlockAction } from "@slack/bolt";
import { postSummaryToThread, postChannelSummary } from "../services/slack";

export const actionPublishSummary = async (app: App) => {
  app.action<BlockAction>(
    "publish_summary",
    async ({ ack, body, client, respond }) => {
      await ack();

      try {
        if (body.actions.length === 0) {
          throw new Error("アクションデータが見つかりません");
        }
        const action = body.actions[0];
        if (action.type !== "button" || !action.value) {
          throw new Error("要約データが見つかりません");
        }

        const [channelId, summaryType, ...rest] = action.value.split(":");
        const encodedSummary = rest.pop() || "";
        const summary = decodeURIComponent(encodedSummary);

        if (summaryType === "channel") {
          const messageCount = parseInt(rest[0] || "0");
          await postChannelSummary(
            client,
            channelId,
            summary,
            messageCount,
            "public"
          );

          if (body.channel?.id && "message" in body && body.message?.ts) {
            await client.chat.update({
              channel: body.channel.id,
              ts: body.message.ts,
              text: `✅ 要約をチャンネルに公開しました (最新${messageCount}件)`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `✅ 要約をチャンネルに公開しました (最新${messageCount}件)`,
                  },
                },
              ],
            });
          }
        } else {
          const threadTs = summaryType === "thread" ? rest[0] : summaryType;
          await postSummaryToThread(
            client,
            channelId,
            threadTs,
            summary,
            "public"
          );

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
          }
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
