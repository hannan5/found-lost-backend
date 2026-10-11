import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { type Env } from "../../config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Thin Nodemailer wrapper. Feature services build the message; this sends it.
 * Without SMTP_HOST (local dev) messages are logged instead of sent.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: nodemailer.Transporter | null;
  private readonly from: string;
  readonly adminEmail: string;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get("SMTP_HOST", { infer: true });
    const user = config.get("SMTP_USER", { infer: true });
    const pass = config.get("SMTP_PASS", { infer: true });
    const port = config.get("SMTP_PORT", { infer: true });

    this.transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: user ? { user, pass } : undefined,
        })
      : null;
    if (!this.transport) {
      this.logger.warn("SMTP_HOST is not set; emails will be logged, not sent.");
    }
    this.from = config.get("MAIL_FROM", { infer: true });
    this.adminEmail = config.get("ADMIN_EMAIL", { infer: true });
  }

  /**
   * Sends one email. Failures are logged, not thrown, so a mail outage never
   * fails the HTTP request that triggered the notification.
   */
  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.log(`[mail skipped] to=${message.to} subject="${message.subject}"`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send "${message.subject}": ${reason}`);
    }
  }
}
