# Cinderia Wiki Data Site

This is a static reference site generated from the exported wiki JSON data.

## Local Preview

From PowerShell:

```powershell
node D:\data_exproter\build_site.mjs
node D:\data_exproter\serve_site.mjs
```

Then open:

```text
http://localhost:4173
```

## Deploy

The `site` folder is static. It can be deployed to GitHub Pages, Cloudflare Pages, Netlify, or any static hosting provider.

Use `D:\data_exproter\build_site.mjs` after every export to refresh `site/data`.
