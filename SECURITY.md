# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in InvariantHold, please report it
privately rather than opening a public issue.

- Email: (add a contact address you monitor, e.g. security@yourdomain.com)
- Please include: a description of the issue, steps to reproduce, and the
  potential impact.
- We aim to acknowledge reports within 5 business days.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | ✅ |

## Scope

This is a demo/hackathon platform (in-memory & SQLite-backed simulation of
security invariant verification). It is not intended to be exposed to the
public internet or connected to real production security infrastructure
without a further security review, since:

- Authentication uses short-lived JWTs signed with a symmetric key
  (`SECRET_KEY`) that must be set via environment variables — see
  `.env.example`.
- Demo credentials are seeded from `ADMIN_PASSWORD` / `ANALYST_PASSWORD` /
  `VIEWER_PASSWORD` environment variables and should be rotated before any
  non-local use.
