# WebFTP — Real FTP Client (Browser UI + Node Backend)

Browsers can't open raw TCP/FTP sockets — that's a security restriction built
into every browser, not something this app works around. So this is a
two-part app:

- **server.js** — a small Node/Express backend that does the real FTP work
  using the `basic-ftp` npm package (a genuine FTP client library).
- **client.html** — the FileZilla-style UI you already saw, now wired to call
  that backend over `fetch()` instead of faking the data.

## Setup

```bash
npm install
node server.js
```

You should see: `WebFTP backend listening on http://localhost:4000`

Then open `client.html` in your browser (double-click it, or run
`npx serve .` and visit the printed URL).

## Using it

1. Enter a real FTP host, username, password, and port in the connection bar
   and click **Quickconnect**. Try your own hosting account, or a public test
   server like `ftp.dlptest.com` (user `dlpuser`, see dlptest.com for current
   credentials — test servers occasionally rotate these).
2. The **Remote site** pane shows the real directory listing from that
   server. Double-click folders to navigate.
3. The **Local site** pane is populated by files *you* pick — click
   **+ Add files…** or drag files from your computer onto that pane. (Browsers
   don't allow JavaScript to silently browse your filesystem; you have to
   select files yourself — same as any web upload form.)
4. Drag a file from Local → Remote to upload it, or Remote → Local to
   download it. Right-click any row for rename/delete/new folder/upload/
   download actions.
5. Switch dark/light mode top-right.

## What's real vs. what's a browser limit

| Feature | Status |
|---|---|
| Connect to real FTP server | ✅ Real (via `basic-ftp`) |
| List/navigate remote directories | ✅ Real |
| Upload / download files | ✅ Real |
| Rename / delete / mkdir | ✅ Real |
| Browse arbitrary local folders automatically | ❌ Not possible from any browser (security sandbox) — you pick files explicitly instead |
| FTPS (explicit TLS) | ✅ Supported — pass `secure: true` in the connect call if needed |

## Notes

- This demo keeps one FTP session per browser tab in server memory — fine
  for local/personal use, not meant as a multi-tenant production deployment
  as-is (no auth on the backend itself, sessions aren't persisted to disk).
- If you deploy the backend somewhere public, put it behind HTTPS and add
  real session auth before exposing it to the internet.
