# BIMI logo

`sequel-logo.svg` is the Sequel mark redrawn to the **SVG Tiny Portable/Secure**
profile that BIMI requires: `baseProfile="tiny-ps"`, `version="1.2"`, a
`<title>`, no `x`/`y` on the root, a square viewBox, a solid white background
and no raster, script, animation or external reference of any kind.

It is served from Cloudflare R2:

| | |
|---|---|
| bucket | `sequelmcp-assets` |
| key | `bimi/logo.svg` |
| URL | <https://assets.sequelmcp.com/bimi/logo.svg> |

To publish a new version:

```bash
pnpm --filter @mails/api exec wrangler r2 object put \
  sequelmcp-assets/bimi/logo.svg \
  --file ../../assets/bimi/sequel-logo.svg \
  --content-type "image/svg+xml" \
  --cache-control "public, max-age=86400" \
  --remote
```

The URL is set as the project's BIMI logo in Settings → Domain & DNS, which
puts the `default._bimi` TXT record into the DNS table and the zone file.
Publishing that record only helps once DMARC is at `p=quarantine` or
`p=reject`, and Gmail, Yahoo and Apple Mail additionally need a VMC or CMC
certificate referenced by the record's `a=` tag.
