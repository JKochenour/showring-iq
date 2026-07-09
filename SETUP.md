# ShowRing IQ — Setup (Sprint 1)

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (any name, e.g. `showring-iq`).
2. Wait for the project to provision.

## 2. Run the database migration

Open your project's **SQL Editor** in the Supabase dashboard, paste the entire
contents of [`supabase/migrations/00001_foundation.sql`](supabase/migrations/00001_foundation.sql),
and run it. It creates:

- `profiles` (auto-created for every new signup via trigger)
- `organizations`, `organization_members`, `organization_invites`
- `organization_permissions` (seeded catalog of ~70 granular permissions)
- `organization_roles` + `organization_role_permissions` (role presets seeded per org)
- `audit_logs`
- RLS policies on every table, plus security-definer RPCs
  (`create_organization`, `invite_member`, `accept_invite`, `set_member_role`,
  `remove_member`, `log_audit`, …)

(Alternatively, with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)

## 3. Configure environment variables

Copy your project's URL and anon key from **Project Settings → API** into
`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

## 4. (Optional, recommended for local dev) Disable email confirmation

Supabase requires email confirmation by default. For faster local testing:
**Authentication → Sign In / Up → Email → turn off "Confirm email"**.

If you leave it on, the confirmation links will work — the app handles them at
`/auth/confirm`. Set **Authentication → URL Configuration → Site URL** to
`http://localhost:3000` so links point at your dev server.

## 5. Run the app

```
npm run dev
```

Then:

1. Sign up at `/signup` (this creates your `profiles` row automatically).
2. Create an organization — you become **Organization Owner** and the nine
   default staff roles are seeded.
3. Invite a member by email + role. Invites don't send email yet (Resend comes
   later); the invitee sees the pending invite on their dashboard when they
   sign in with that email address.
4. Check the **Audit log** tab — org creation, invites, role changes, and
   removals are all recorded.

## What's in Sprint 1

- Email/password auth (Supabase Auth, SSR cookies, Next 16 `proxy.ts` session refresh)
- Organizations (create, edit profile, tenant-scoped by RLS)
- Members: invite → accept flow, role assignment, removal (last-owner protected)
- Granular permission catalog + role presets (Owner, Show Manager, Show
  Secretary, Assistant Secretary, Judge, Gate, Announcer, Treasurer, Score Verifier)
- Audit log (viewable with `audit.view` permission)

## Next: Sprint 2 — Show creation

Create show, show dashboard, settings, staff assignment.
