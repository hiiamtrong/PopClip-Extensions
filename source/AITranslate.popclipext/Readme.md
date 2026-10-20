# AI Translate

A PopClip extension to translate, improve, or humanize selected text using an
OpenAI-compatible API with Structured Outputs support.

### Actions

**Translate** — Translates text written entirely in your Secondary Language to
your Primary Language. Primary-language, other-language, and mixed-language
selections are translated completely to your Secondary Language.

**Improve** — Preserves the language of selections written entirely in either
your Primary or Secondary Language while improving grammar, clarity, and style.
Mixed-language and other-language selections are converted completely to your
Secondary Language.

**Humanizer** — Uses the same language routing as Improve, removes common
AI-writing patterns, and shortens the text without dropping facts or changing
its meaning or voice.

Each of these actions sends one request. The model detects the selection's
language and returns a strict response `{ langInput, body, langOutput }`. The
extension checks `langOutput` against the routing rules above and shows an error
instead of pasting a result in the wrong language. They replace the selected
text by default; this can be changed to append or copy via the Response Handling
settings.

### Configuration

#### API Key

Paste your API key into the _API Key_ field. The key is stored securely in your
macOS Keychain.

- **OpenAI**: Obtain a key at <https://platform.openai.com/account/api-keys>
- **Groq**: Obtain a key at <https://console.groq.com/keys>
- **Other providers**: Check their documentation for API key instructions.

#### Model / Custom Model

Select a model from the dropdown, or enter a model name in _Custom Model_ to
override it. Leave _Custom Model_ blank to use the dropdown selection.

#### API Base Domain

The base domain for the API endpoint. Defaults to `api.openai.com/v1` for
OpenAI. Change this to use another provider that supports Chat Completions
Structured Outputs (`response_format: json_schema`):

- **OpenAI**: `api.openai.com/v1` (default)
- **Groq**: `api.groq.com/openai/v1`
- **Google Gemini**: `generativelanguage.googleapis.com/v1beta/openai`

#### Primary / Secondary Language

- **Primary Language**: Preserved by Improve and Humanizer; also the Translate
  output for selections entirely in your Secondary Language (default: `English`)
- **Secondary Language**: Preserved by Improve and Humanizer and used for their
  mixed-language output; also the Translate output for Primary Language,
  other-language, and mixed-language selections (default: `Spanish`)

#### Additional Instructions

Optional extra instructions appended to the system prompt. Use this to
customise translation or improvement behaviour. Examples:

- `Keep original formatting. Do not translate code, variable names, or URLs.`
- `Use natural phrasing, not literal translation.`
- `Be concise. Use a professional tone.`
- `Keep the writer's casual voice.`

### Notes

A selection can contain the object replacement character (U+FFFC), which apps
use for an inline image such as an emoji. Plain text cannot carry the image
back, so the extension replaces each one with a space, or removes it next to a
line break, before sending the text.

Author: hiiamtrong

## Changelog

- 2026-10-20: Translate, Improve and Humanizer now send one request per action
  and require a provider with Structured Outputs
  (`response_format: json_schema`). Added the Humanizer action.
- 2026-04-30: Initial release.
