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
app.command("/summarize", async ({ command, ack, respond, client }) => {
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

    // 要約をスレッドに投稿
    await postSummaryToThread(client, channelId, threadTs, summary);
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

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log("⚡️ Slack bot is running");
})();
