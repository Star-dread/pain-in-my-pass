# Kagi Web Search for AnythingLLM

A custom **Agent Skill** that adds [Kagi Search API](https://kagi.com/api) web
search to [AnythingLLM](https://anythingllm.com). Kagi is not a natively
supported search provider in AnythingLLM, so this skill fills that gap with a
reliable, repeatable integration.

Tested on AnythingLLM Desktop (AppImage) v1.17.0, Linux, with a local Ollama
model (`gemma4:latest`).

---

## Why a custom skill instead of an Agent Flow?

AnythingLLM's **Agent Flow → API Call block** has a bug: when the Request Body
is set to JSON and contains a `${variable}` reference, the flow executor
**intermittently sends a completely empty body**, which the server rejects with
**HTTP 400 Bad Request**. Rebuilding the flow does not reliably fix it, because
the bug lives in the block itself.

A custom Agent Skill sidesteps this entirely: the query arrives as a plain
function argument, and the request body is built with `JSON.stringify` in code.
There is no interpolation step to fail.

| | Agent Flow (API Call block) | Custom Skill ✅ |
|---|---|---|
| Query passing | Broken `${}` interpolation → empty body → 400 | Native function argument |
| Body construction | Flow executor (buggy) | `JSON.stringify` in your code |
| Reliability | Intermittent failures | Repeatable success |
| Debugging | Opaque | `introspect()` / `logger()` |

> ⚠️ **Do not use Kagi's legacy v0 endpoint as a workaround.** It is deprecated.
> Use v1.

---

## Prerequisites

- A **Kagi API Key** from <https://kagi.com/api/keys>
  - Use the **Copy key** button (not manual selection).
  - The key must have **Search** enabled under its *Allowed Products* setting.
  - A payment method / prepaid credit is required (v1 is pay-per-use).
- AnythingLLM Desktop installed.

---

## Installation

### 1. Locate your skills directory

| Platform | Path |
|---|---|
| Linux / AppImage | `~/.config/anythingllm-desktop/storage/plugins/agent-skills/` |
| macOS | `~/Library/Application Support/anythingllm-desktop/storage/plugins/agent-skills/` |
| Windows | `%APPDATA%\anythingllm-desktop\storage\plugins\agent-skills\` |
| Docker | `/app/server/storage/plugins/agent-skills/` |

> **AppImage shortcut:** click the version number in the top-right corner of the
> app → **"Open storage"**.

### 2. Create the skill folder

The folder name **must** match the `hubId` in `plugin.json` — both are
`kagi-web-search`.

```bash
mkdir -p ~/.config/anythingllm-desktop/storage/plugins/agent-skills/kagi-web-search
```

### 3. Add the files

Copy `plugin.json` into the folder and rename it to **`plugin.json`**,
then copy `handler.js` alongside it.

```
kagi-web-search/
├── plugin.json
└── handler.js
```

### 4. Restart AnythingLLM

Close the app **completely** and relaunch. The app scans the plugins folder only
at startup.

### 5. Enable the skill and add your key

1. Go to **Agent Settings → Skills**.
2. Find **kagi-web-search** and toggle it **ON**.
3. Click the **gear icon** and paste your **Kagi API key** into the
   `KAGI_API_KEY` field.

> ⚠️ Paste the **raw key only** — **no** `Bearer ` prefix. The handler adds it.

AnythingLLM will persist the key back into `plugin.json`'s `"value"` field
automatically. You never edit that field by hand.

### 6. Test

```
@agent kagi-web-search what is the average size of an apple?
```

You should get a synthesized answer with cited sources.

---

## Verifying your key independently

Before troubleshooting AnythingLLM, confirm the key works with `curl`:

```bash
curl "https://kagi.com/api/v1/search" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "workflow": "search"}'
```

A healthy response is `HTTP/2 200` with a `data.search` array. If this fails,
the problem is the key or account — not AnythingLLM.

---

## The credential trap (read this if you get 401)

Kagi has **three** credentials, and only **one** works for the v1 Search API.
Using the wrong type produces a token that *passes signature validation* but is
*unauthorized* — a confusing failure mode.

| Credential | Wire format | Unlocks | Works for v1 Search? |
|---|---|---|---|
| **API Key** | `Authorization: Bearer <key>` | `/api/v1` (Search, Extract) | ✅ **Use this** |
| Legacy API Token | `Authorization: Bot <token>` | `/api/v0` (deprecated) | ❌ |
| Session Token | session link | Subscriber web features | ❌ |

Get the **API Key** from <https://kagi.com/api/keys> — not the general
`/settings/api` page.

---

## Error decoder

| Error | Meaning | Fix |
|---|---|---|
| `400 Bad Request` | Empty/invalid body | Confirm the query reaches the API; check the key field is set |
| `401 Unauthorized` | Wrong credential type, or key lacks entitlement | Use the **API Key**; enable **Search** in Allowed Products; check billing |
| `404 Not Found` | Wrong URL/method | Confirm `POST https://kagi.com/api/v1/search` |
| `invalid_token` — "signature failed to verify" | Key bytes wrong (stray space/newline, truncation) | Re-copy the key with the button |
| Skill missing from list | Folder name ≠ `hubId`, or app not restarted | Rename folder to `kagi-web-search`; restart |
| Skill loads but `@agent` can't see it | Known bug where enabled custom skills are missing from `@agent` | Toggle off/on, restart; check `storage/logs/` |

---

## Dead ends (don't repeat these)

These were attempted during development and failed or are no longer viable.
They are documented here to save you the hours they cost:

1. **Agent Flow → API Call block** — the `${variable}`-in-JSON-body bug
   intermittently sends an empty body → HTTP 400. Not fixable by rebuilding the
   flow.
2. **Legacy v0 endpoint** (`/api/v0/search?q=…` with `Authorization: Bot …`) —
   deprecated by Kagi.
3. **Mixing credential types** — `Bearer` with v0, or `Bot` with v1, produces
   signature/authorization errors.
4. **Placeholder tokens** — literally sending `YOUR_TOKEN` returns
   `invalid_token` ("Token signature failed to verify").

---

## Response schema

`data.search[]` items contain:

- `url`, `title`, `snippet` (always)
- `time`, `image`, `props` (optional)
- `props` may include `language`, `language_probability`, `ai_generated`, `group_id`

Videos appear under `data.video[]`.

This skill returns a trimmed shape (`title`, `url`, `snippet`) to keep the LLM
context lean. Edit `handler.js` if you want more fields.

---

## Security

- The API key is stored in `plugin.json` by AnythingLLM. **Never publish a
  `plugin.json` containing a live key.** Use `plugin.template.json`, which has
  `"value": ""`.
- If a key is ever exposed (screenshots, logs, chat, git history), **revoke it**
  at <https://kagi.com/api/keys>, generate a new one, and re-enter it via the
  skill's gear icon. Nothing else changes.

---

## License

MIT — see [LICENSE](LICENSE).
