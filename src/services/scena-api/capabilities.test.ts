import { describe, expect, it } from "vitest";
import {
  classifyUploadableAsset,
  SCENA_UI_API_CAPABILITIES,
} from "./capabilities";

describe("Scena UI API capabilities", () => {
  it("allows the three worker-backed source types", () => {
    expect(classifyUploadableAsset({
      name: "poster.png",
      type: "image/png",
      size: 100,
    })).toBe("image");

    expect(classifyUploadableAsset({
      name: "deck.pptx",
      type: "",
      size: 100,
    })).toBe("powerpoint");

    expect(classifyUploadableAsset({
      name: "document.pdf",
      type: "application/pdf",
      size: 100,
    })).toBe("pdf");
  });

  it("rejects unsupported and oversized files", () => {
    expect(classifyUploadableAsset({
      name: "movie.mp4",
      type: "video/mp4",
      size: 100,
    })).toBeNull();

    expect(classifyUploadableAsset({
      name: "huge.png",
      type: "image/png",
      size: SCENA_UI_API_CAPABILITIES.assets.maxSourceBytes + 1,
    })).toBeNull();
  });

  it("keeps publishing disabled until a publication endpoint exists", () => {
    expect(SCENA_UI_API_CAPABILITIES.boards.publish).toBe(false);
  });
});
