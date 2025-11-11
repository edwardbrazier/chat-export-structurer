# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Contact:** Open a private security advisory on GitHub or email the maintainer directly.

Please do **not** open a public issue for security vulnerabilities.

### What to include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

You can expect a response within 48 hours.

## Security Considerations

This tool:
- Runs entirely locally (no network requests)
- Does not transmit data anywhere
- Stores data in local SQLite files
- Processes sensitive conversation data

### Best Practices

Always:
- Review exports before sharing sample data
- Keep your SQLite databases secure with appropriate file permissions
- Be cautious when importing data from untrusted sources
- Sanitize any example files before contributing them

### Data Privacy

This tool is designed with privacy in mind:
- No telemetry or analytics
- No external API calls
- All processing happens on your machine
- Your conversation data never leaves your computer

