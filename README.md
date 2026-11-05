# RepoShelf V2

Private GitHub project library built with Next.js, React, and Supabase.

## Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the complete script in `supabase/schema.sql`.
3. In Supabase Authentication > Users, create your private user with your email and a strong password. Disable public sign-ups in Authentication settings.
4. Copy the project URL and publishable (or legacy anon) key from Project Settings > API.
5. Set these environment variables before building:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

6. Install dependencies and build:

```bash
npm install
npm run build
```

The static export is generated in `out/`. Upload the contents of `out/` to Hostinger's `public_html`.

## Security

- Never put a Supabase service-role/secret key in browser code.
- RLS is enabled; authenticated users can access only rows whose `owner` equals their own Auth user ID.
- Disable public sign-ups. Create the sole user from the Supabase dashboard.
- Configure Supabase Auth > URL Configuration with your production site URL and local development URL.
- The Supabase publishable/anon key is designed for browser use when RLS is correctly configured.

## Data migration

The old collection is in browser localStorage under `github-repository-library:v1`. Export or copy the data from the browser where it currently exists before switching. The old data model contains GitHub metadata; map it into the new fields before importing.
