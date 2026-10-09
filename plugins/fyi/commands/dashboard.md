---
description: Open the fyi dashboard in the browser, starting it if it is not running
---

The dashboard serves http://localhost:3456.

1. If `curl -sf http://localhost:3456/health` answers, it is running.
2. Otherwise start it so it outlives this session:
   `nohup ~/.jay/plugins/fyi/dashboard/start.sh >/dev/null 2>&1 &`,
   then wait until the health check answers, for up to 10 seconds. If it
   does not, run `~/.jay/plugins/fyi/dashboard/start.sh` in the foreground
   briefly to show the user why.
3. Give the user the URL. It also lists the views of other installed
   plugins' dashboards.

To stop it, the user ends the process listening on port 3456.
