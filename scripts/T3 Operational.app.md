# T3 Operational.app

Bundle path in this checkout:

`apps/desktop/T3 Operational.app`

Install it to Applications by double-clicking:

`scripts/Install T3 Operational.command`

The installer updates only `/Applications/T3 Operational.app`; it does not
touch the installed T3 Nightly application. After installation, drag **T3
Operational** from Applications to the Dock.

Daily workflow:

1. Finish and close legacy T3 completely.
2. Click **T3 Operational** in Applications or the Dock.

The app launches the separate desktop build from this checkout with
`/Users/snedmusic/.t3-operational`, the operational database, operational
Electron identity, and port `3774`. It refuses while legacy T3 is active.
It is not the installed nightly app.

For a read-only diagnostic, run this from the checkout:

```sh
apps/desktop/'T3 Operational.app'/Contents/MacOS/'T3 Operational' --diagnose
```

The diagnostic log is also written to:
`/Users/snedmusic/.t3-operational/userdata/logs/operational-launcher.log`.
