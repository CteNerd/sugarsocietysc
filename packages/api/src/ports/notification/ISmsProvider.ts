export interface SendSmsParams {
  to: string;
  message: string;
}

/** Port for outbound SMS. Swap SNS -> Twilio by adding an adapter + factory entry only. */
export interface ISmsProvider {
  send(params: SendSmsParams): Promise<void>;
}
