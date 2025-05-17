import { App, BlockAction } from "@slack/bolt";
import { postThreadSummary, postChannelSummary } from "../services/slack";

export const actionPublishSummary = async (app: App) => {
  app.action<BlockAction>("publish_summary", async ({ ack, body, client }) => {
    await ack();

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

    try {
      if (summaryType === "channel") {
        const messageCount = parseInt(rest[0] || "0");
        await postChannelSummary(
          client,
          channelId,
          summary,
          messageCount,
          "public"
        );

        if (body.message) {
          await client.chat.update({
            channel: channelId,
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
        await postThreadSummary(client, channelId, threadTs, summary, "public");

        if (body.message) {
          await client.chat.update({
            channel: channelId,
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
      await client.chat.postEphemeral({
        channel: channelId,
        user: body.user.id,
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
      });
    }
  });
};
