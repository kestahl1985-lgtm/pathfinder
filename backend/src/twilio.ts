import twilio from "twilio";
import type { Question, WhatsAppButton } from "./types.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

export async function sendText(toPhoneNumber: string, message: string) {
  try {
    const msg = await client.messages.create({
      from: twilioPhoneNumber,
      to: toPhoneNumber,
      body: message,
    });
    return msg.sid;
  } catch (error) {
    console.error("Error sending Twilio message:", error);
    throw error;
  }
}

export async function sendButtons(
  toPhoneNumber: string,
  message: string,
  buttons: WhatsAppButton[]
) {
  try {
    const msg = await client.messages.create({
      from: twilioPhoneNumber,
      to: toPhoneNumber,
      body: message,
      contentSid: undefined,
    });
    return msg.sid;
  } catch (error) {
    console.error("Error sending Twilio buttons:", error);
    throw error;
  }
}

export async function sendQuestion(
  toPhoneNumber: string,
  question: Question
): Promise<string> {
  const buttons = question.options.map((opt, idx) => ({
    id: `${question.number}-${idx}`,
    title: opt.text.substring(0, 20),
  }));

  return sendButtons(toPhoneNumber, question.text, buttons);
}

export function parseWebhookMessage(body: Record<string, string>) {
  return {
    from: body.From,
    to: body.To,
    messageBody: body.Body,
    messageId: body.MessageSid,
  };
}
