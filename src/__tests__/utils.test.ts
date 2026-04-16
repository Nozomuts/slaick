import { BlockAction, BlockElementAction } from "@slack/bolt";
import { initialize } from "../utils";

const createMockBody = (
  actionValue: string
): BlockAction<BlockElementAction> =>
  ({
    actions: [
      {
        type: "button",
        value: actionValue,
      },
    ],
  }) as unknown as BlockAction<BlockElementAction>;

describe("initialize", () => {
  describe("channelタイプ", () => {
    it("チャンネル要約データを正しく解析できること", () => {
      const summary = "テスト要約";
      const encoded = encodeURIComponent(summary);
      const body = createMockBody(`channel:C12345:${encoded}:10`);

      const result = initialize(body);

      expect(result.type).toBe("channel");
      expect(result.channelId).toBe("C12345");
      expect(result.summary).toBe(summary);
      if (result.type === "channel") {
        expect(result.messageCount).toBe(10);
      }
    });

    it("messageCountが省略された場合は0を返すこと", () => {
      const encoded = encodeURIComponent("要約");
      const body = createMockBody(`channel:C12345:${encoded}:`);

      const result = initialize(body);

      if (result.type === "channel") {
        expect(result.messageCount).toBe(0);
      }
    });
  });

  describe("threadタイプ", () => {
    it("スレッド要約データを正しく解析できること", () => {
      const summary = "スレッド要約";
      const encoded = encodeURIComponent(summary);
      const body = createMockBody(`thread:C12345:${encoded}:1234567890.123456`);

      const result = initialize(body);

      expect(result.type).toBe("thread");
      expect(result.channelId).toBe("C12345");
      expect(result.summary).toBe(summary);
      if (result.type === "thread") {
        expect(result.threadTs).toBe("1234567890.123456");
      }
    });
  });

  describe("エラーケース", () => {
    it("アクションが存在しない場合はエラーをスローすること", () => {
      const body = {
        actions: [],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("アクションデータが見つかりません");
    });

    it("ボタン以外のアクションタイプの場合はエラーをスローすること", () => {
      const body = {
        actions: [{ type: "static_select", value: "channel:C12345:test:10" }],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("要約データが見つかりません");
    });

    it("actionのvalueがない場合はエラーをスローすること", () => {
      const body = {
        actions: [{ type: "button" }],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("要約データが見つかりません");
    });

    it("不正なタイプの場合はエラーをスローすること", () => {
      const encoded = encodeURIComponent("要約");
      const body = createMockBody(`invalid:C12345:${encoded}:10`);

      expect(() => initialize(body)).toThrow("不正な要約タイプです");
    });
  });
});
