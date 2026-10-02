#!/bin/sh
set -eu

if ! awslocal s3api head-bucket --bucket local-uploads >/dev/null 2>&1; then
  awslocal s3api create-bucket --bucket local-uploads
fi

awslocal s3api put-bucket-cors \
  --bucket local-uploads \
  --cors-configuration '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000","http://127.0.0.1:3000"],"AllowedMethods":["GET","HEAD","PUT"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]}'
