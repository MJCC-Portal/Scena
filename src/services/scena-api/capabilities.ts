export const SCENA_UI_API_CAPABILITIES = Object.freeze({
  assets: Object.freeze({
    maxSourceBytes: 262_144_000,
    uploadKinds: ["image", "pdf", "powerpoint"] as const,
    video: false,
    audio: false,
    fonts: false,
  }),
  boards: Object.freeze({
    list: true,
    create: true,
    load: true,
    save: true,
    revisions: true,
    archive: true,
    publish: false,
  }),
  elements: Object.freeze({
    static: ["text", "image", "shape", "asset_page", "qr_static"] as const,
    live: [
      "clock",
      "date",
      "countdown",
      "qr_dynamic",
      "music_player",
      "ticker",
      "carousel",
      "video",
      "weather",
      "data_text",
    ] as const,
  }),
  workers: Object.freeze({
    imageIngest: true,
    pdfImport: true,
    powerpointImport: true,
    sceneRender: false,
    videoIngest: false,
    audioIngest: false,
    fontIngest: false,
  }),
});

export type UploadableAssetKind =
  (typeof SCENA_UI_API_CAPABILITIES.assets.uploadKinds)[number];

export function classifyUploadableAsset(
  file: Pick<File, "name" | "type" | "size">,
): UploadableAssetKind | null {
  if (file.size <= 0 || file.size > SCENA_UI_API_CAPABILITIES.assets.maxSourceBytes) {
    return null;
  }

  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint" ||
    name.endsWith(".pptx") ||
    name.endsWith(".ppt")
  ) {
    return "powerpoint";
  }

  return null;
}
