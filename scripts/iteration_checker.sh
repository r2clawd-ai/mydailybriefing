#!/bin/bash
cd ~/.openclaw/workspace/briefing-app
git log --oneline -3 2>/dev/null
curl -s --max-time 4 "$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf_tunnel.log 2>/dev/null | tail -1)/health" 2>/dev/null | python3 -c "import json,sys; print('backend:', json.load(sys.stdin).get('status'))" 2>/dev/null
