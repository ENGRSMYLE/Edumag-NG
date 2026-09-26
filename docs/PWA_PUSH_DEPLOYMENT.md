# PWA and Web Push Deployment Checklist

## Generate credentials

- Run `python scripts/generate_vapid_keys.py` from `backend/` once per environment.
- Back up the pair in the deployment secret manager.
- Never commit `.env`, `.env.local`, or the private key.
- Keep the same pair while subscriptions are active; rotation invalidates existing subscriptions.

## Backend on Render

- Set `WEB_PUSH_VAPID_PUBLIC_KEY` from the generated public key.
- Set `WEB_PUSH_VAPID_PRIVATE_KEY` as a secret available only to backend and worker services.
- Set `WEB_PUSH_SUBJECT` to a monitored `mailto:` address or HTTPS contact URL.
- Confirm `/health` succeeds after deployment.
- Never expose the private key through health, settings, or notification APIs.

## Frontend deployment

- Set `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` to the same public key.
- Never create a `NEXT_PUBLIC_` variable containing the private key.
- Rebuild the frontend after changing a `NEXT_PUBLIC_` value.
- Confirm `/manifest.webmanifest`, `/sw.js`, and `/icons/*` load over HTTPS.

## Verification

- Confirm backend configuration reports push enabled internally without returning keys.
- Search the frontend build output for the private key and require zero matches.
- Confirm development starts when all VAPID variables are blank or absent.
- Confirm partial key configuration fails startup with a configuration error.
