#!/bin/sh
# Runs automatically once LocalStack reports ready (/etc/localstack/init/ready.d).
# Creates the patient-documents bucket the app expects, with versioning on so a
# document overwrite never destroys the prior copy (matches the prod S3 policy).
set -e
awslocal s3 mb s3://lims-patient-documents || true
awslocal s3api put-bucket-versioning \
  --bucket lims-patient-documents \
  --versioning-configuration Status=Enabled || true
echo "LocalStack: lims-patient-documents bucket ready."
