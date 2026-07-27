# T3 Operational rollback

Use only after closing T3 Operational. Confirm the operational launcher has
released port `3774`, then open the existing legacy T3 application normally.
Never run both profiles at once.

T3 Operational is a separate desktop build launched from the T3 source
checkout, using `/Users/snedmusic/.t3-operational`. It is not the installed
nightly application. The installed wrapper is an ad-hoc-signed local app, not
Apple-notarized; upgrades should rerun the installer from the source checkout.

```sh
/usr/sbin/lsof -nP -iTCP:3774 -sTCP:LISTEN
open -a "T3 Code"
```

This does not modify or delete `/Users/snedmusic/.t3/userdata/state.sqlite` or
any archive. Keep `/Users/snedmusic/.t3-operational` and its receipts intact
for diagnosis and retry.
