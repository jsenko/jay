---
description: Open the fyi dashboard in the browser, starting it if it is not running
---

1. Run `~/.jay/plugins/fyi/dashboard/run.sh start`. It starts the
   dashboard unless it is running, so that it outlives this session, and
   prints the URL. When it fails, it prints why; show the user.
2. Give the user the URL. The page also lists the views of other
   installed plugins' dashboards.

To stop it, `~/.jay/plugins/fyi/dashboard/run.sh stop`.
