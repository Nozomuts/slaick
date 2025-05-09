import { App } from "@slack/bolt";
import * as dotenv from "dotenv";
import { summarizeThread } from "./utils/openRouter";
import { getThreadMessages, postSummaryToThread } from "./utils/thread";

dotenv.config();

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  token: process.env.SLACK_BOT_TOKEN!,
});

// スラッシュコマンドハンドラ
app.command("/summarize", async ({ command, ack, respond, client, body }) => {
  await ack();

  try {
    // エフェメラルメッセージで処理中を通知
    await respond({
      text: "📝 要約を作成しています...",
      response_type: "ephemeral",
    });

    const channelId = command.channel_id;
    // コマンド引数からスレッドTSを取得（引数がない場合は直接コマンドが実行されたチャンネルを対象）
    const threadTs = command.text || command.ts;

    // スレッドメッセージを取得
    const threadText = await getThreadMessages(client, channelId, threadTs);

    // OpenRouterでスレッドを要約
    const summary = await summarizeThread(threadText);

    // ユーザーID取得
    const userId = body.user_id;

    // まず非公開で要約結果を表示
    await postSummaryToThread(client, channelId, threadTs, summary, "private");

    // 公開するボタン付きの通知
    await respond({
      text: "📝 スレッドの要約が完了しました（あなただけに表示されています）",
      response_type: "ephemeral",
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
              value: `${channelId}:${threadTs}:${encodeURIComponent(summary)}`,
              action_id: "publish_summary_to_thread",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("要約処理エラー:", error);
    await respond({
      text: `エラーが発生しました: ${
        error instanceof Error ? error.message : "不明なエラー"
      }`,
      response_type: "ephemeral",
    });
  }
});

// 公開要約ボタンのアクションハンドラ
app.action("publish_summary_to_thread", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTs, encodedSummary] = value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    // スレッドに公開として投稿
    await postSummaryToThread(client, channelId, threadTs, summary, "public");

    // 確認メッセージを送信
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
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
  } catch (error) {
    console.error("要約公開エラー:", error);
  }
});

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log("⚡️ Slack bot is running");
})();
