# Lab Cookie Rotation Runbook

Short, practical guide for rotating the two Lab-related secrets that live
in Vercel environment variables. Start here if you suspect a leak, an
employee with Vercel access leaves, or it's just been a year.

| Env var             | Purpose                                                   | Where it's used           |
|---------------------|-----------------------------------------------------------|---------------------------|
| `LAB_COOKIE_SECRET` | HMAC-SHA256 key that signs `fa_lab` session cookies       | `lib/labAuth.js`          |
| `LAB_CODES`         | Comma-separated list of valid unlock codes customers type | `app/api/lab/unlock/route.js` |

The two are independent — rotating one does not require rotating the other.

---

## When to rotate

Rotate `LAB_COOKIE_SECRET` when:

1. **Vercel access change** — an employee or contractor with env-var read access leaves.
2. **Suspected compromise** — env file leaked to a Slack thread, logs, Git, etc. Rotate same-day.
3. **Annual hygiene** — pick a date (e.g. January 1) and rotate even without a specific trigger.
4. **Post-incident** — after any security incident affecting infra, rotate alongside other credentials.

Rotate `LAB_CODES` when:

1. A specific code was given to someone whose access you now want to revoke.
2. Annual hygiene, same schedule as the cookie secret.
3. You want to invite a new wave of Lab customers with fresh codes.

---

## Side effects of rotation

**`LAB_COOKIE_SECRET` rotation:**
- All currently-active Lab sessions become invalid. The next request that reads
  the cookie (e.g. a checkout attempt for a hidden product, or `verifyLabCookie()`
  in `/api/orders`) will fail signature verification and return 401.
- Affected customers will see "Access denied" at checkout and have to re-enter
  their Lab code at `/lab` to get a fresh cookie.
- No data loss — carts are client-side, products still exist, nothing server-side
  is purged. It's a "sign in again" event.

**`LAB_CODES` rotation:**
- Existing Lab sessions *remain valid* (cookie signature is independent of the
  code list). Customers who are already unlocked stay unlocked until they close
  the browser.
- New unlock attempts with old codes → 401. You need to share the new codes
  with anyone who should retain access.

**Rotating both at once:** everyone loses access immediately and needs a new
code. Use this for the nuclear-option scenario (suspected breach, aggressive
cleanup).

---

## How to rotate `LAB_COOKIE_SECRET`

1. **Generate a new secret** (64 hex chars, 256 bits of entropy — matches the
   HMAC-SHA256 block size):

   ```bash
   openssl rand -hex 32
   # or, if openssl isn't handy:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Copy the output to your clipboard.

2. **Update Vercel:**
   - Go to Vercel → `forgeamino-site` → Settings → Environment Variables
   - Find `LAB_COOKIE_SECRET` → Edit (pencil icon)
   - Paste the new value
   - Confirm Production + Preview are checked (leave Development alone —
     local dev has its own `.env.local`)
   - Save

3. **Trigger a redeploy** so the running Lambdas pick up the new env value:
   - Deployments tab → latest production deploy → ⋯ → Redeploy
   - Keep "Use existing Build Cache" checked (faster; no code changed)
   - Wait for READY state (~90s)

4. **Update your local `.env.local`** if you run dev locally — otherwise
   your local Lab sessions will break on next `npm run dev`.

5. **Announce if needed.** If active Lab customers will be affected and
   you want to warn them proactively, send a heads-up email saying
   "Please re-enter your Lab access code — we rotated security keys."

---

## How to rotate `LAB_CODES`

1. **Decide the new code list.** Format: comma-separated, trimmed. Example:
   `A7F2-9QK3,B8H1-2MT5,C4N9-7PX0`.
   Suggested generator:

   ```bash
   # 4 random codes, dash-separated chunks
   for i in 1 2 3 4; do
     node -e "const r=()=>require('crypto').randomBytes(2).toString('hex').toUpperCase(); console.log(\`\${r()}-\${r()}\`)"
   done
   ```

2. **Update Vercel:** Settings → Environment Variables → `LAB_CODES` →
   Edit → paste new comma-separated list → Save.

3. **Redeploy** (same as step 3 above).

4. **Share new codes** with allow-listed customers via whatever channel you
   use — email, in-person, encrypted message, etc. Do not commit codes
   to Git or paste into chat transcripts that get logged.

---

## Verification after rotation

End-to-end smoke test that takes ~2 minutes:

1. Open an incognito window → `/lab` → enter a new code → should land on
   the Lab product page with cookie set.
2. Add a hidden product to the cart → checkout → order should go through
   (confirms `verifyLabCookie()` is accepting the new cookie).
3. Open a **second** incognito window → `/lab` with an **old** code that
   you just removed → should get "Invalid code" (confirms `LAB_CODES` is
   enforcing the new list).
4. Check Vercel runtime logs for any `event: "lab-unlock"` entries with
   `outcome: "not_configured"` — that would indicate `LAB_CODES` got
   cleared instead of replaced. If seen, go back to Vercel and re-save.

---

## Rollback

If something breaks after rotation (e.g. redeploy failed, customers
can't unlock):

1. **Same-deploy rollback:** Vercel → Deployments → find the pre-rotation
   deploy → ⋯ → Promote to Production. This reverts code but leaves env
   vars changed, so sessions still break. Useful only if rotation itself
   caused a bug (unlikely — no code changed).

2. **Env-var rollback:** Vercel → Settings → Environment Variables → edit
   the rotated secret → paste the old value back → Save → Redeploy. Only
   possible if you kept a copy of the old secret somewhere secure. If you
   didn't, you cannot roll back — every user just has to re-unlock, which
   is the expected side effect anyway.

**Bottom line:** rotation is cheap and safe because the worst case is
"customers re-enter their codes once." There's no data-loss risk. Don't
over-think it — rotate on schedule.
