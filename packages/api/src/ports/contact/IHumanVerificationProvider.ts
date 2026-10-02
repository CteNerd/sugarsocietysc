export interface IHumanVerificationProvider {
  verify(token: string): Promise<boolean>;
}
