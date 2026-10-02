import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, UploadImageParams } from '../../ports/storage/IStorageProvider';

export class S3StorageProvider implements IStorageProvider {
  private readonly client: S3Client;

  constructor(
    private readonly bucketName: string,
    region: string,
    endpoint?: string,
  ) {
    this.client = new S3Client({
      region,
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true,
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          }
        : {}),
    });
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async uploadImage({ key, contentType, body }: UploadImageParams): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
