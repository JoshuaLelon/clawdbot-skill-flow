# Changelog

All notable changes to the Skill Flow plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added
- Multi-step workflow orchestration for Clawdbot
- Deterministic button-driven flows (bypasses LLM for instant responses)
- Telegram inline keyboard support via `channelData` pattern
- Configurable session management (timeout, cleanup interval)
- Configurable history logging (enable/disable JSONL storage)
- Input validation (number, email, phone)
- Variable interpolation in messages (`{{variableName}}`)
- Conditional branching based on captured variables
- Hooks system for custom behavior:
  - `onStepRender` - Dynamic button generation
  - `onCapture` - External logging/integration
  - `onFlowComplete` - Post-completion actions
  - `onFlowAbandoned` - Timeout/cancellation tracking
- Custom storage backend support
- JSONL append-only history logging
- Automatic session cleanup and timeout handling
- Commands: `/flow-start`, `/flow-list`, `/flow-create`, `/flow-delete`, `/flow-step`
- Example flows: pushups workout, customer survey, onboarding wizard

### Security
- Path traversal protection for dynamically loaded hooks and storage backends
- All file paths validated to stay within `~/.clawdbot/flows/` directory
- Safe path resolution prevents directory escape attempts

### Requirements
- **Clawdbot**: v2026.1.25 or later (requires Telegram `sendPayload` support)
  - PR: https://github.com/clawdbot/clawdbot/pull/1917
  - Older versions: buttons will not render in Telegram

### Technical Details
- Session timeout: configurable (default 30 minutes)
- Cleanup interval: configurable (default 5 minutes)
- History storage: configurable (default enabled)
- Max flows per user: configurable (default unlimited)
- Built with TypeScript, tested with Vitest
- Code coverage: 38% (core engine and validation fully covered)

[0.1.0]: https://github.com/joshualelon/clawdbot-skill-flow/releases/tag/v0.1.0
