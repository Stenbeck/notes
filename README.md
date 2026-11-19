# notes.

**notes. is a self-hosted writing workspace for everything from quick notes to whole projects.** Your notes live on the hosting you choose.

- **Give big ideas room to grow.** Organize your writing into projects and nested documents, with checklists, tables, images, and attachments.
- **Pick up where you left off.** Install notes. as a progressive web app (PWA) on supported devices. Keep writing offline and let your changes sync across devices when you reconnect.
- **Keep your workspace private.** Sign in with a passkey and share individual documents by link. Add a password to a shared link when you want to limit who can open it.
- **Take your writing with you.** Copy a document as Markdown for a blog post, export your workspace as Markdown or JSON, or bring existing documents in from i.e. Outline.
- **Connect the tools you already use.** Use the included MCP server to connect compatible tools, or build your own workflows with the API. Choose which projects each connection can access and whether it can edit them.

## Getting started

You’ll need a host that can keep a Node.js 24 LTS process running (24.7 or newer), a dedicated MongoDB 7+ database, and an SMTP service for setup and email sign-in. Use HTTPS when accessing notes.

1. **Download.** Download the latest version from GitHub Releases, unpack it, and open a terminal in the extracted folder. Run `cp .env.example .env`.
2. **Configure.** In `.env`, set `BASE_URL` to the address you’ll open in your browser. Set `MONGODB_URI`, `SMTP_HOST`, and `SMTP_FROM_EMAIL`. Fill in the other SMTP settings your mail provider requires. Set `AUTH_SECRET` to the output of `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. For attachments, set `NOTES_DATA_DIR` to a writable directory on persistent storage or set `STORAGE_DRIVER=s3` and fill in the S3 settings.
3. **Start.** Run the commands below. Open `/setup` on your instance, enter the setup token printed in the terminal, and verify your email. You can then create a passkey.

   ```sh
   npm ci
   npm run build
   npm run setup
   node --env-file=.env .output/server/index.mjs
   ```

notes. by Fredrik Stenbeck. Released under the [MIT License](LICENSE).
