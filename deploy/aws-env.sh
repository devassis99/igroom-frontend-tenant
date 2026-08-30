#!/bin/sh
#
# Writes .env.production from AWS Secrets Manager, for `vite build` to
# read. Vite loads .env.production automatically in production mode, so
# nothing in the app has to change and `pnpm dev` against a local .env is
# untouched.
#
# These values are NOT secret — every VITE_ variable is compiled into the
# bundle and served to every visitor. They live in Secrets Manager so that
# the API URL and the Google client id are maintained in one account
# rather than in three GitHub settings pages, next to the backend values
# they have to agree with.
#
set -eu

: "${SECRETS_MANAGER_SECRET_ID:?SECRETS_MANAGER_SECRET_ID is required}"
ENV_FILE="${ENV_FILE:-.env.production}"

# Two separate hazards, both of which corrupt a value silently:
#
#   1. dotenv's parser strips surrounding quotes but unescapes nothing,
#      so a backslash-escaped quote survives into the value as a literal
#      backslash. Single quotes are the only safe wrapper: they pass ",
#      `, # and backslashes through untouched. A value containing a
#      single quote cannot be represented at all, and is refused by name.
#   2. Vite additionally runs dotenv-expand over what it loads, so a
#      bare $ is read as a variable reference — a token containing $NAME
#      is silently replaced with nothing, and the app ships with a
#      truncated key. Escaping every $ as \$ is what stops that; verified
#      against a real `vite build`, not assumed.
#
# The quote is written as \u0027 so this jq program contains no single
# quote itself and can sit inside shell single quotes.
JQ_TO_DOTENV='
  def q: "\u0027";
  to_entries
  | map(select(.value != null))
  | map(.value |= (tostring | gsub("\\$"; "\\$")))
  | map(
      if (.key | test("^[A-Za-z_][A-Za-z0-9_]*$") | not)
      then error("\(.key) is not a usable environment variable name")
      elif (.value | contains(q))
      then error("the value of \(.key) contains a single quote, which a .env file cannot escape")
      else . end
    )
  | map("\(.key)=" + q + .value + q)
  | .[]
'

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRETS_MANAGER_SECRET_ID" \
  --query SecretString --output text) || {
    echo "error: could not read $SECRETS_MANAGER_SECRET_ID." >&2
    echo "  The deploy role needs secretsmanager:GetSecretValue on it, and AWS_REGION must be set." >&2
    exit 1
  }

# Written to a temporary file first, so a failure here cannot leave a
# half-written .env.production for `vite build` to pick up and bake a
# broken configuration into the bundle.
TMP_ENV="${ENV_FILE}.tmp"
printf '%s' "$SECRET_JSON" | jq -er "$JQ_TO_DOTENV" > "$TMP_ENV" || {
    rm -f "$TMP_ENV"
    echo "error: $SECRETS_MANAGER_SECRET_ID is not a flat JSON object of environment variables," >&2
    echo "  or one of its entries cannot be written to a .env file (see the error above)." >&2
    exit 1
  }
mv "$TMP_ENV" "$ENV_FILE"

# Key names only — a value has never belonged in a log line, and in CI
# that log is often more widely readable than the secret is.
printf '%s' "$SECRET_JSON" |
  jq -r '[to_entries[] | select(.value != null) | .key] | join(" ")' |
  sed 's/^/wrote '"$ENV_FILE"': /'

# A build with no VITE_API_BASE_URL produces an app that looks fine and
# cannot reach the API — the kind of failure that is only found by a
# person clicking something. Better to stop here.
if ! grep -q '^VITE_API_BASE_URL=' "$ENV_FILE"; then
  echo "error: the secret has no VITE_API_BASE_URL" >&2
  exit 1
fi
