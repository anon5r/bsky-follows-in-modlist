# Save Your Follows

**Save Your Follows** is a web application that checks if any users you follow (or your followers) are included in a specific Bluesky list (Moderation List or Curated List).

This tool is useful for:
- Checking if your friends are inadvertently included in block lists.
- Finding which of your follows are part of a specific community or curated list.

![Save Your Follows OGP](public/ogp.svg)

## Features

- **Secure Login:** OAuth (DPoP + Nonce) authentication with Bluesky. No password sharing required.
- **Privacy Focused:** All data processing happens client-side in your browser. No data is stored on our servers.
- **Comprehensive Check:**
  - Fetch all your follows (and optionally followers).
  - Fetch all members of a target list (supports large lists with pagination).
  - Compare and display matches with detailed user info.
- **Bilingual:** Fully supports English and Japanese (auto-detected).
- **Responsive Design:** Works on desktop and mobile devices.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS (v4)
- **Bluesky Integration:** `@atproto/api`, `@atproto/oauth-client-browser`
- **Deployment:** Vercel (recommended)

## Development

### Prerequisites

- Node.js (v18 or later)
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/follows-in-list.git
   cd follows-in-list
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Access the app at `http://127.0.0.1:5173/`.
   *Note: Due to OAuth restrictions, use `127.0.0.1` instead of `localhost`.*

### Build

To build for production:

```bash
npm run build
```

## Deployment

This project is optimized for deployment on **Vercel**.

1. Push your code to a GitHub repository.
2. Import the repository in Vercel.
3. Vercel will automatically detect the Vite framework and configure the build settings.
4. Deploy!

### Environment Variables & OAuth

The application uses dynamic OAuth metadata generation (`api/client-metadata.ts`) to support Vercel's preview and production URLs automatically. No manual environment variable configuration for OAuth is typically required for standard deployments.

## License

MIT License