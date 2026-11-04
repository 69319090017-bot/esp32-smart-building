# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Zero-PII & Secrets Commitment

This project strictly adheres to a **Zero Personally Identifiable Information (Zero-PII)** and **Zero-Secret** commitment:

1. **No Credentials in Git:** All secret configuration files (`secrets.env`, `secrets.h`, `.env`) are excluded by `.gitignore`.
2. **Template Safe Placeholders:** `secrets.example.env` and `secrets.example.h` contain only fictional placeholder values.
3. **Log Sanitization:** Firmware and bot logs mask usernames, emails (e.g. `u***@example.com`), and authentication tokens.
4. **Principle of Least Privilege:** ESP32 devices authenticate with short-lived JWT tokens rather than permanent database admin master secrets.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please follow these steps:

1. **Do NOT open a public GitHub issue** to disclose security vulnerabilities.
2. Email the maintainers privately or open a **Private Vulnerability Report** via GitHub Security Advisories.
3. Include detailed steps to reproduce the issue, along with any relevant log outputs or code references.
4. Maintainers will acknowledge receipt within 48 hours and work on a prompt patch.

Thank you for helping keep our project and its users safe!
