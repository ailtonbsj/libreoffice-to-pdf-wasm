# Libreoffice to PDF Converter

Convert Libreoffice files to PDF using WebAssembly.

## How to run locally

```bash
# Install Vercel CLI
npm i -g vercel

# Install dependencies
npm i

# Run Serverless Function locally
vercel dev
```

## Manual use locally

Access [http://localhost:3000](http://localhost:3000/) and upload file locally.

## Use as an external API

```bash
# Upload file to the endpoint using multipart/form-data browser-based
curl -L -F "file=@myfile.fodt" http://localhost:3000/api/upload
```

Teste locally in [http://localhost:3000/form.html](http://localhost:3000/form.html)

## LibreOffice WASM files for browser-based document conversion

Using assets from npm package `@bentopdf/libreoffice-wasm`.