export interface UploadImageParams {
  key: string;
  contentType: string;
  body: Buffer;
}

/** Port for binary asset storage (customer-uploaded cookie design images, etc.). */
export interface IStorageProvider {
  uploadImage(params: UploadImageParams): Promise<string>;
  getUploadUrl(key: string, contentType: string, contentLength: number, expiresInSeconds?: number): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
