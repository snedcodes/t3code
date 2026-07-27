# T3 Operational rollback

Use only after closing T3 Operational. Confirm the operational launcher has
released port `3774`, then open the existing legacy T3 application normally.
Never run both profiles at once.

```sh
/usr/sbin/lsof -nP -iTCP:3774 -sTCP:LISTEN
open -a "T3 Code"
```

This does not modify or delete `/Users/snedmusic/.t3/userdata/state.sqlite` or
any archive. Keep `/Users/snedmusic/.t3-operational` and its receipts intact
for diagnosis and retry.
