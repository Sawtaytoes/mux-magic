#!/usr/bin/env bash
set -euo pipefail

yarn workspace @media-tools/server run start-server &
SERVER_PID=$!

yarn wait-on http://localhost:3000/openapi.json --timeout 30000

yarn generate-schemas

kill $SERVER_PID
