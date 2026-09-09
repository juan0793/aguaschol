# Security Review

Security review for AI-built projects. Covers the OWASP Top 10.

You built a new product with AI. It works. Users are signing up. But you're not a security engineer, and you know there are things you're not seeing. Leaked API keys, open databases, configs that shouldn't be public. Type one command, get a full report with the exact code to fix each issue.

Built from [oktsec](https://github.com/oktsec/oktsec) and [Aguara](https://github.com/garagon/aguara), two open source cybersecurity projects for AI agents.

## Install

```bash
npx skills add oktsec/security-review
```

Then type `/security-review` in any project.

Works in Claude Code, Cursor, Codex, Windsurf, and [38+ tools](https://skills.sh) that support skills.

## Update

```bash
npx skills add oktsec/security-review -y -g
```

Reinstalling updates to the latest version.

## What it does

Reads your project, figures out what you're using, and reviews everything. No questions, no setup. It auto-detects your stack, your database, your auth provider, your payment system, whatever you have.

Things it catches:

API keys that ended up in your code or in your git history. Database access rules that let any logged-in user read everyone else's data. Auth middleware that looks like it's protecting your routes but isn't. User input going straight into your AI prompts. Endpoints with no rate limiting where someone can run up your API bill overnight. Payment webhooks that aren't verifying who sent them, so anyone can fake a "payment successful" event. Passwords stored in a way that can be cracked in seconds. Config files with secrets that shouldn't be public.

Each finding comes with the file, the line number, and the exact code to fix it. Secret values are always redacted in the report.

After the report, it asks if you want it to fix the issues. If you say yes, it works through them from highest severity to lowest, applies the fixes, and re-runs the checks to confirm they're resolved.

## How to use it

**First run:** `/security-review` scans your entire project and gives you a scored report (A to F).

**Fix and re-run:** Apply the fixes, then run it again. It reads the current filesystem, not git history. If you fixed something, it won't report it again. Your score should improve each run.

**Large projects:** If results vary between runs, scan by directory for consistent results: `/security-review src/api/` then `/security-review src/components/`.

## Example

```
> /security-review

## Security Report
**Project:** my-saas
**Stack:** Next.js 15 + Supabase + Clerk + Stripe + OpenAI
**Score: D**

### Critical
1. **Database key in client code** `.env.local:4`
   Service role key shipped to every browser. Move to server-side only.

2. **AI key exposed** `.env:8`
   Anyone can use your API key. Remove NEXT_PUBLIC_ prefix.

### High
3. **Auth middleware protects nothing** `middleware.ts:3`
   Default config without route matching. Add protected routes.
4. **Prompt injection** `app/api/chat/route.ts:12`
   User input interpolated into system prompt.
5. **No rate limiting on /api/chat**
   Attacker can run up your OpenAI bill.

### Top 3 actions
1. Move database and AI keys to server-side only
2. Add route protection to auth middleware
3. Add rate limiting to AI endpoints
```

## OWASP Top 10 coverage

130+ checks mapped to the [OWASP Top 10](https://owasp.org/www-project-top-ten/):

**A01: Broken Access Control** . Supabase without RLS, Firebase without security rules, mass assignment, Clerk middleware misconfiguration, Server Actions without auth, API routes without middleware, path traversal.

**A02: Cryptographic Failures** . Leaked API keys (16 provider patterns), private keys in code, hardcoded secrets, connection strings with passwords, `Math.random()` used for tokens instead of `crypto`.

**A03: Injection** . SQL injection (9 patterns), XSS (7 patterns), command injection, SSRF, open redirects, prompt injection via user input to LLMs, unsafe deserialization (`pickle.load`, `yaml.load`, `eval`).

**A04: Insecure Design** . Missing rate limiting on auth and AI endpoints, no webhook signature verification, client-side payment amounts.

**A05: Security Misconfiguration** . Wildcard CORS, debug mode in production, `NEXT_PUBLIC_` env var exposure, `0.0.0.0` bindings, missing security headers (HSTS, CSP, X-Frame-Options), exposed `.git` directory.

**A06: Vulnerable Components** . `npm audit` / `pip audit` / `govulncheck`, unpinned dependency versions, open-ended version ranges.

**A07: Auth Failures** . MD5/SHA for password hashing, JWT without expiry, algorithm none attack, insecure cookie flags, missing rate limiting on login.

**A08: Data Integrity Failures** . Unverified Stripe webhooks, unsafe deserialization (`pickle.load`, `eval()` with user input, `yaml.load` without SafeLoader), unpinned dependencies.

**A09: Logging and Monitoring** . No logging on failed auth attempts, no error monitoring service, passwords and request bodies in logs.

**A10: SSRF** . User-controlled URLs in `fetch`, `axios`, `requests`, `http.Get` without allowlist validation.

## License

Apache-2.0
