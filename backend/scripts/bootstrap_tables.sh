#!/usr/bin/env bash
#
# Ensure DynamoDB Local tables exist based on the SAM template.
#
# Requirements:
#   - AWS CLI (aws)
#   - yq (https://mikefarah.gitbook.io/yq/)
#
# Usage:
#   DYNAMODB_ENDPOINT=http://localhost:8000 ./scripts/bootstrap_tables.sh template.yaml
#
# The script will iterate over every AWS::DynamoDB::Table defined in the template
# and create it in the local DynamoDB instance if it is missing.

set -euo pipefail

TEMPLATE_PATH=${1:-template.yaml}
ENDPOINT_URL=${DYNAMODB_ENDPOINT:-http://localhost:8000}
STAGE_VALUE=${STAGE:-dev}

if ! command -v yq >/dev/null 2>&1; then
  echo "❌ yq is required but not installed. See https://mikefarah.gitbook.io/yq/ for installation instructions." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ AWS CLI is required but not installed. See https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 1
fi

if [ ! -f "${TEMPLATE_PATH}" ]; then
  echo "❌ Template file '${TEMPLATE_PATH}' not found." >&2
  exit 1
fi

tables_query='.Resources | to_entries | map(select(.value.Type == "AWS::DynamoDB::Table")) | .[].key'
table_keys_raw=$(yq eval -r "${tables_query}" "${TEMPLATE_PATH}" || true)

if [ -z "${table_keys_raw}" ]; then
  echo "ℹ️  No DynamoDB tables defined in ${TEMPLATE_PATH}."
  exit 0
fi

echo "🔍 Scanning template '${TEMPLATE_PATH}' for DynamoDB tables..."

while IFS= read -r logical_name; do
  [ -z "${logical_name}" ] && continue

  table_name=$(yq eval ".Resources.${logical_name}.Properties.TableName" "${TEMPLATE_PATH}")

  if [ -z "${table_name}" ] || [ "${table_name}" = "null" ]; then
    echo "⚠️  Skipping ${logical_name}: TableName not set."
    continue
  fi

  table_name=${table_name//\$\{Stage\}/${STAGE_VALUE}}

  if aws dynamodb describe-table --table-name "${table_name}" --endpoint-url "${ENDPOINT_URL}" >/dev/null 2>&1; then
    echo "✅ Table '${table_name}' already exists."
    continue
  fi

  properties_json=$(yq eval -o=json ".Resources.${logical_name}.Properties" "${TEMPLATE_PATH}")
  properties_json=${properties_json//\$\{Stage\}/${STAGE_VALUE}}

  echo "🛠️  Creating table '${table_name}'..."
  aws dynamodb create-table \
    --cli-input-json "${properties_json}" \
    --endpoint-url "${ENDPOINT_URL}"

  aws dynamodb wait table-exists \
    --table-name "${table_name}" \
    --endpoint-url "${ENDPOINT_URL}"

  echo "✅ Table '${table_name}' created."
done <<< "${table_keys_raw}"

echo "🎉 DynamoDB bootstrap complete."

