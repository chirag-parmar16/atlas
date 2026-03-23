# Security Policy

## Security Assumptions

Atlas operates under a **Zero-Assumption Security Model**. This means:
1. **No External Trust**: We do not trust the target domain's headers, query parameters, or responses. All inputs are validated at runtime using Zod schemas.
2. **PII Filtering by Default**: Atlas assumes all API communication might contain sensitive data. PII scanning (emails, credit cards, tokens) is active by default on non-HTML responses.
3. **Environment-Based Context**: Users are encouraged to provide `ATLAS_USER_EMAIL` and `ATLAS_AUTHORIZED_TOKENS` so the scanner can filter out legitimate traffic from actual leaks.

## Security Features

- **PII Masking**: Sensitive data is masked in audit logs using a `first4****last4` pattern.
- **IPC Validation**: All communication between the UI and the Electron main process is strictly typed and validated to prevent path traversal and injection.
- **Content Security Policy (CSP)**: Strict CSPs are enforced on all HUD and Dashboard windows.
- **Runtime Input Validation**: HTTP headers and query parameters are validated against schemas before being proxied to the target domain.

## Reporting a Vulnerability

If you discover a security vulnerability within Atlas, please report it via the following process:
1. **Email**: Send a detailed report to security@atlas-sandbox.io (Placeholder).
2. **Detail**: Include reproduction steps, potential impact, and suggested fixes.
3. **Disclosure**: We follow responsible disclosure practices. Please allow us 30 days to address the issue before public disclosure.

## Environment Variables

| Variable | Purpose | Security Context |
|----------|---------|------------------|
| `ATLAS_USER_EMAIL` | User's own email | Prevents self-leak false positives |
| `ATLAS_AUTHORIZED_TOKENS` | Known safe tokens | Prevents flagging authorized traffic |
| `ATLAS_DEBUG_PORT` | CDP Debugging | Only active in development/debug modes |
