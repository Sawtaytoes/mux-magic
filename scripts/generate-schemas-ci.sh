#!/usr/bin/env bash
set -euo pipefail

yarn workspace @media-tools/server run start &
SERVER_PID=$!

npx wait-on http://localhost:3000/openapi.json --timeout 30000

yarn generate-schemas

kill $SERVER_PID
