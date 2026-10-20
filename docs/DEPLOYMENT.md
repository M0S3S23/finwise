# Deploying FinWise

FinWise needs two things: a **MongoDB Atlas** database and a **Node.js host** (Vercel or Render). Total time: ~20 minutes. Both have free tiers suitable for a demo or a single small business.

---

## 1. MongoDB Atlas

1. Sign up at **cloud.mongodb.com** → **Create a cluster** → choose **M0 (Free)**. Pick a region close to your users (e.g. *Johannesburg (af-south-1)* on AWS for Southern Africa).
2. **Database Access → Add New Database User**: username + strong password, role *Read and write to any database*.
3. **Network Access → Add IP Address**:
   - Vercel/Render use changing IPs, so add `0.0.0.0/0` (allow from anywhere). Access is still protected by the user/password. For stricter setups use Atlas private endpoints on a paid tier.
4. **Database → Connect → Drivers** → copy the connection string and add the database name before the `?`:
   ```
   mongodb+srv://finwise:<password>@cluster0.abc12.mongodb.net/finwise?retryWrites=true&w=majority
   ```
   URL-encode special characters in the password (e.g. `@` → `%40`).

Atlas clusters are replica sets, so FinWise's **multi-document transactions** (sales, voids, restocks) work automatically.

## 2. Generate a secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3a. Deploy on Vercel (recommended)

1. Push the project to a GitHub repository.
2. On **vercel.com → Add New → Project**, import the repo (framework auto-detected as Next.js).
3. **Environment Variables**:
   | Name | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas string |
   | `AUTH_SECRET` | the generated secret |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |
4. **Deploy**. Under *Settings → Functions*, choose the region nearest your Atlas cluster (e.g. `cpt1` Cape Town) to minimise latency.

## 3b. Deploy on Render

1. **render.com → New → Web Service** → connect the repo.
2. Runtime **Node**, Build command `npm ci && npm run build`, Start command `npm start`.
3. Add the same environment variables. Choose a region near your Atlas cluster.
4. Create the service. (Free instances sleep after inactivity; the first request then takes ~30 s.)

## 4. After deploying

- Open the URL, **create your business account**, or seed demo data from your machine:
  ```bash
  MONGODB_URI="<atlas string>" npm run seed
  ```
- Run the smoke test against the live site (creates throwaway test businesses — use a staging database if you prefer):
  ```bash
  BASE_URL=https://<your-app> node scripts/smoke-test.mjs
  ```
- Check the PWA: open Chrome DevTools → **Application → Manifest / Service workers**, or run a Lighthouse audit (PWA + Performance).
- Add a **custom domain** in Vercel/Render settings (HTTPS is automatic — required for PWA installs).

## 5. Operations

- **Backups**: M0 has no automated backups. Export periodically with `mongodump "<uri>"`, or upgrade to M10+ for continuous cloud backups. Users can also export CSVs from *Settings → App & data*.
- **Monitoring**: Atlas → *Metrics* for database load; Vercel/Render logs for API errors (prefixed `[FinWise API]`).
- **Updating**: push to the main branch; the host rebuilds automatically. When `public/sw.js` changes, bump `VERSION` inside it so clients pick up new caches.
- **Scaling**: replace the in-memory login rate limiter with a shared store (e.g. Upstash Redis) when running multiple instances.

## 6. Local development without Atlas

Any MongoDB **replica set** works, e.g. Docker:
```bash
docker run -d -p 27017:27017 --name finwise-mongo mongo:7 --replSet rs0
docker exec finwise-mongo mongosh --eval "rs.initiate()"
# MONGODB_URI="mongodb://127.0.0.1:27017/finwise?directConnection=true"
```
A standalone (non-replica-set) server also works — FinWise detects this and runs without transactions, logging a warning.
