#!/bin/sh
set -eu

awslocal sqs create-queue --queue-name sugarsocietysc-contact >/dev/null
