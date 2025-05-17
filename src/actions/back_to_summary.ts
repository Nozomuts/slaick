import { App } from "@slack/bolt";

export const actionBackToSummary = async (app: App) => {
  app.action("back_to_summary", async ({ ack, body, client, respond }) => {
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
      const [channelId, threadTsOrMarker, ...rest] = value.split(":");
      const encodedSummary = rest.pop() || "";
      const summary = decodeURIComponent(encodedSummary);
      const messageCountOrThreadTs = rest.join(":") || threadTsOrMarker;

      if (!body.channel?.id) {
        await respond({
          text: "元のメッセージを特定できませんでした。",
          response_type: "ephemeral",
          replace_original: false,
        });
        return;
      }

      // threadTsが"channel"で始まる場合はチャンネル要約、そうでなければスレッド要約
      if (threadTsOrMarker === "channel") {
        const messageCount = parseInt(messageCountOrThreadTs);

        // 元のチャンネル要約画面に戻す
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
          text: "📝 チャンネルの要約が完了しました（あなただけに表示されています）",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📝 *チャンネル要約が完了しました (最新${messageCount}件)*\n\n要約結果はあなただけに表示されています。チャンネルに公開することもできます。`,
              },
            },
            {
              type: "actions",
              block_id: "summary_visibility",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "チャンネルに公開する",
                    emoji: true,
                  },
                  style: "primary",
                  value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                  action_id: "publish_channel_summary",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Notionにエクスポート",
                    emoji: true,
                  },
                  value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                  action_id: "export_channel_to_notion",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Markdownで表示",
                    emoji: true,
                  },
                  value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                  action_id: "show_channel_markdown",
                },
              ],
            },
          ],
        });
      } else {
        // 元のスレッド要約画面に戻す
        const threadTs = messageCountOrThreadTs;
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
          text: "📝 スレッドの要約が完了しました（あなただけに表示されています）",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "📝 *スレッド要約が完了しました*\n\n要約結果はあなただけに表示されています。スレッドに公開することもできます。",
              },
            },
            {
              type: "actions",
              block_id: "summary_visibility",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "スレッドに公開する",
                    emoji: true,
                  },
                  style: "primary",
                  value: `${channelId}:${threadTs}:${encodedSummary}`,
                  action_id: "publish_summary_to_thread",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Notionにエクスポート",
                    emoji: true,
                  },
                  value: `${channelId}:${threadTs}:${encodedSummary}`,
                  action_id: "export_to_notion",
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Markdownで表示",
                    emoji: true,
                  },
                  value: `${channelId}:${threadTs}:${encodedSummary}`,
                  action_id: "show_markdown",
                },
              ],
            },
          ],
        });
      }
    } catch (error) {
      console.error("画面復元エラー:", error);
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
  });
};
