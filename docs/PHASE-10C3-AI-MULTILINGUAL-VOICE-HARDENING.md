# Phase 10C.3 — AI Multilingual & Voice Hardening

## Scope

This hotfix keeps the Velliqo AI workspace, proactive intelligence and browser voice layer aligned with the language currently selected by the owner.

Supported languages:

- English
- Greek
- German
- Spanish
- Turkish

## Behaviour

- The UI-selected language is authoritative for each AI request.
- Conversation history is separated by business, user and language.
- Switching language starts a clean language-specific conversation to prevent mixed-language context.
- Daily briefings and proactive alerts are stored and loaded independently per language.
- A missing briefing in the selected language is generated automatically for the current business.
- Speech recognition and speech synthesis use the matching locale.
- Browser recognition cycles are restarted when Chrome ends them prematurely.
- The request is submitted only after at least three seconds without newly detected speech.
- Visible Action Engine confirmations and permissions remain unchanged.

## Deployment

1. Merge the code.
2. Apply migration `00043_velliqo_ai_multilingual_voice_hardening.sql`.
3. Deploy `velliqo-ai-manager`.
4. Deploy `process-ai-manager-automations`.
5. Test all five languages with text, voice and an action confirmation.
