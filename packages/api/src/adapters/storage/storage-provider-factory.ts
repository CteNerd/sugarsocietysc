import { AppConfig } from '../../config/env';
import { IStorageProvider } from '../../ports/storage/IStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

export function createStorageProvider(config: AppConfig): IStorageProvider {
  switch (config.storageProvider) {
    case 's3':
      return new S3StorageProvider(config.uploadsBucketName, config.awsRegion, config.awsEndpointUrl);
  }
}
