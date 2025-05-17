import { App } from "@slack/bolt";

export const shortcutSummarizeChannel = async (app: App) => {
  app.shortcut("summarize_channel", async ({ shortcut, ack, client }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: {
          type: "modal",
          callback_id: "channel_select_modal",
          title: {
            type: "plain_text",
            text: "チャンネルを選択",
            emoji: true,
          },
          submit: {
            type: "plain_text",
            text: "要約する",
            emoji: true,
          },
          close: {
            type: "plain_text",
            text: "キャンセル",
            emoji: true,
          },
          blocks: [
            {
              type: "input",
              block_id: "channel_select_block",
              element: {
                type: "channels_select",
                placeholder: {
                  type: "plain_text",
                  text: "要約するチャンネルを選択",
                  emoji: true,
                },
                action_id: "channel_select",
              },
              label: {
                type: "plain_text",
                text: "チャンネル",
                emoji: true,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error("チャンネル選択モーダル表示エラー:", error);
    }
  });
};
