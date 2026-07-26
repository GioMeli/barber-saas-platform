# Phase 9E — Velliqo Voice Assistant

## Scope

Phase 9E adds a browser voice layer to the existing Velliqo AI Manager. It does not create a second AI or action system.

- Speech recognition uses the browser Web Speech implementation with interim results.
- Final transcripts are sent through the existing `velliqo-ai-manager` conversation endpoint.
- Spoken responses use browser speech synthesis.
- The user can interrupt speech and immediately start a new microphone turn.
- Pending actions continue to use the Phase 9C Action Engine.
- Medium- and high-risk actions can never be executed from a spoken confirmation.
- Low-risk voice confirmation is disabled by default and requires both `allow_write_actions` and `voice_allow_low_risk_confirmation`.

## Database

Apply:

```bash
npx supabase db push
```

Migration `00040_velliqo_ai_voice_assistant.sql` adds voice settings, privacy-safe voice sessions and event audit records. It does not store a duplicate raw transcript.

## Owner configuration

Open:

`AI Settings → Voice Assistant`

Recommended first test:

- Enable Voice Assistant
- Enable spoken responses
- Disable continuous conversation for the first test
- Keep low-risk voice confirmation disabled

## Runtime smoke test

1. Open `Velliqo AI`.
2. Select the microphone button beside Send.
3. Start a voice session and allow microphone permission.
4. Confirm that interim speech appears in the live transcript.
5. Confirm that the final transcript is sent into the normal AI conversation.
6. Confirm that Velliqo reads the response aloud.
7. While Velliqo speaks, choose **Interrupt and speak**.
8. Request an action and confirm that the visible Action Engine card appears in the normal conversation.
9. Verify that a medium- or high-risk action cannot be executed by saying yes.

## Validation

```bash
npm run translations:check
npm run ai:check
npm run automations:check
npm run voice:check
npm run typecheck
npm run build
```
