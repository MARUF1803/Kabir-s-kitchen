# Kabir's Kitchen frontend

## Development

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

In development, the API defaults to `http://localhost:5143/api`. Override it
with `VITE_API_BASE_URL` when the API runs elsewhere.

## Production build

Set `VITE_API_BASE_URL` in the build environment to the public API base URL,
including the `/api` path, for example `https://api.example.com/api`. Production
builds require an absolute HTTPS URL; the development localhost default is never
embedded in a production build.

```sh
npm run build
```
