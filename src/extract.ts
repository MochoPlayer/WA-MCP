import type { proto } from "@whiskeysockets/baileys";

export interface ExtractedContent {
  text: string;
  type: string;
}

/**
 * WhatsApp message payloads come in many nested shapes.
 * Unwrap the wrappers, then pull out human-readable text.
 * Returns null for protocol noise (key distribution, deletions, etc.).
 */
export function unwrapMessage(message: proto.IMessage): proto.IMessage {
  return (
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message.documentWithCaptionMessage?.message ??
    message.editedMessage?.message?.protocolMessage?.editedMessage ??
    message
  );
}

/** Message types whose file can be downloaded later with the download_media tool. */
export const MEDIA_TYPES = new Set(["document", "image", "video", "audio"]);

/** File name for a downloaded media message (documents keep their own name). */
export function mediaFileName(message: proto.IMessage | null | undefined, fallbackId: string): string {
  const m = message ? unwrapMessage(message) : null;
  const doc = m?.documentMessage;
  if (doc?.fileName) return doc.fileName;
  const ext = m?.imageMessage ? "jpg" : m?.videoMessage ? "mp4" : m?.audioMessage ? "ogg" : "bin";
  return `${fallbackId}.${ext}`;
}

export function extractContent(message: proto.IMessage | null | undefined): ExtractedContent | null {
  if (!message) return null;

  const m = unwrapMessage(message);

  if (m.conversation) return { text: m.conversation, type: "text" };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, type: "text" };
  if (m.imageMessage) return { text: m.imageMessage.caption || "[image]", type: "image" };
  if (m.videoMessage) return { text: m.videoMessage.caption || "[video]", type: "video" };
  if (m.documentMessage)
    return { text: m.documentMessage.caption || `[document: ${m.documentMessage.fileName || "file"}]`, type: "document" };
  if (m.audioMessage) return { text: m.audioMessage.ptt ? "[voice message]" : "[audio]", type: "audio" };
  if (m.stickerMessage) return { text: "[sticker]", type: "sticker" };
  if (m.locationMessage)
    return {
      text: `[location: ${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}]`,
      type: "location",
    };
  if (m.liveLocationMessage) return { text: "[live location]", type: "location" };
  if (m.contactMessage) return { text: `[contact: ${m.contactMessage.displayName || ""}]`, type: "contact" };
  if (m.contactsArrayMessage) return { text: "[contacts]", type: "contact" };
  if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) {
    const poll = m.pollCreationMessage ?? m.pollCreationMessageV2 ?? m.pollCreationMessageV3;
    return { text: `[poll: ${poll?.name || ""}]`, type: "poll" };
  }
  if (m.reactionMessage) return null; // reactions are noise for chat history
  if (m.protocolMessage) return null; // deletions, key changes, etc.

  return null;
}
