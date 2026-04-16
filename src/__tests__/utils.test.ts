import { describe, it, expect } from "vitest";
import { initialize } from "../utils";
import type { BlockAction, BlockElementAction } from "@slack/bolt";

const makeBody = (value: string): BlockAction<BlockElementAction> =>
  ({
    actions: [
      {
        type: "button",
        value,
      },
    ],
  }) as unknown as BlockAction<BlockElementAction>;

describe("initialize", () => {
  it("スレッドタイプのアクションを正しく解析する", () => {
    const summary = "テスト要約";
    const channelId = "C12345";
    const threadTs = "1234567890.123456";
    const value = `thread:${channelId}:${encodeURIComponent(summary)}:${threadTs}`;

    const result = initialize(makeBody(value));

    expect(result.type).toBe("thread");
    expect(result.channelId).toBe(channelId);
    expect(result.summary).toBe(summary);
    if (result.type === "thread") {
      expect(result.threadTs).toBe(threadTs);
    }
  });

  it("チャンネルタイプのアクションを正しく解析する", () => {
    const summary = "チャンネル要約";
    const channelId = "C67890";
    const messageCount = 10;
    const value = `channel:${channelId}:${encodeURIComponent(summary)}:${messageCount}`;

    const result = initialize(makeBody(value));

    expect(result.type).toBe("channel");
    expect(result.channelId).toBe(channelId);
    expect(result.summary).toBe(summary);
    if (result.type === "channel") {
      expect(result.messageCount).toBe(messageCount);
    }
  });

  it("アクションが空の場合はエラーをスローする", () => {
    const body = {
      actions: [],
    } as unknown as BlockAction<BlockElementAction>;

    expect(() => initialize(body)).toThrow("アクションデータが見つかりません");
  });

  it("ボタン以外のアクションタイプの場合はエラーをスローする", () => {
    const body = {
      actions: [
        {
          type: "static_select",
          value: undefined,
        },
      ],
    } as unknown as BlockAction<BlockElementAction>;

    expect(() => initialize(body)).toThrow("要約データが見つかりません");
  });

  it("不正な要約タイプの場合はエラーをスローする", () => {
    const value = `unknown:C12345:${encodeURIComponent("要約")}:extra`;
    expect(() => initialize(makeBody(value))).toThrow("不正な要約タイプです");
  });
});
