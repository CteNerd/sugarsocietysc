export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Port for outbound email. Implementations must not leak vendor-specific types to callers. */
export interface IEmailProvider {
  send(params: SendEmailParams): Promise<void>;
}
