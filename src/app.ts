import { App } from "@slack/bolt";
import * as dotenv from "dotenv";
import { actionPublishSummaryToThread } from "./actions/publish_summary_to_thread";
import { actionExportToNotion } from "./actions/export_to_notion";
import { actionShowMarkdown } from "./actions/show_markdown";
import { actionBackToSummary } from "./actions/back_to_summary";
import { shortcutSummarizeThread } from "./shortcuts/summarize_thread";
import { shortcutSummarizeChannel } from "./shortcuts/summarize_channel";
import { viewChannelSelectModal } from "./views/channel_select_modal";

dotenv.config();

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

shortcutSummarizeThread(app);
shortcutSummarizeChannel(app);

actionPublishSummaryToThread(app);
actionExportToNotion(app);
actionShowMarkdown(app);
actionBackToSummary(app);

viewChannelSelectModal(app);

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log("⚡️ Slack bot is running");
})();
