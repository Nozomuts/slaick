import { BlockAction, BlockElementAction } from "@slack/bolt";
import { initialize } from "../utils";

const createMockBlockAction = (value: string): BlockAction<BlockElementAction> =>
  ({
    actions: [
      {
        type: "button",
        value,
      },
    ],
  } as unknown as BlockAction<BlockElementAction>);

describe("initialize", () => {
  describe("channel タイプ", () => {
    it("channel タイプのパラメータを正しくパースする", () => {
      const channelSummary = "テスト要約";
      const encoded = encodeURIComponent(channelSummary);
      const body = createMockBlockAction(`channel:C123456:${encoded}:10`);

      const result = initialize(body);

      expect(result.type).toBe("channel");
      expect(result.channelId).toBe("C123456");
      expect(result.summary).toBe(channelSummary);
      if (result.type === "channel") {
        expect(result.messageCount).toBe(10);
      }
    });

    it("messageCount が省略された場合は 0 になる", () => {
      const encoded = encodeURIComponent("要約");
      const body = createMockBlockAction(`channel:C123:${encoded}:`);

      const result = initialize(body);

      expect(result.type).toBe("channel");
      if (result.type === "channel") {
        expect(result.messageCount).toBe(0);
      }
    });
  });

  describe("thread タイプ", () => {
    it("thread タイプのパラメータを正しくパースする", () => {
      const threadSummary = "スレッド要約";
      const encoded = encodeURIComponent(threadSummary);
      const body = createMockBlockAction(`thread:C789:${encoded}:1234567890.123456`);

      const result = initialize(body);

      expect(result.type).toBe("thread");
      expect(result.channelId).toBe("C789");
      expect(result.summary).toBe(threadSummary);
      if (result.type === "thread") {
        expect(result.threadTs).toBe("1234567890.123456");
      }
    });
  });

  describe("エラーケース", () => {
    it("actions が空の場合はエラーをスローする", () => {
      const body = {
        actions: [],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("アクションデータが見つかりません");
    });

    it("action タイプが button でない場合はエラーをスローする", () => {
      const body = {
        actions: [{ type: "static_select", value: "channel:C123:abc:5" }],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("要約データが見つかりません");
    });

    it("action の value が存在しない場合はエラーをスローする", () => {
      const body = {
        actions: [{ type: "button" }],
      } as unknown as BlockAction<BlockElementAction>;

      expect(() => initialize(body)).toThrow("要約データが見つかりません");
    });

    it("不正な type の場合はエラーをスローする", () => {
      const body = createMockBlockAction("unknown:C123:abc:");

      expect(() => initialize(body)).toThrow("不正な要約タイプです");
    });
  });
});
