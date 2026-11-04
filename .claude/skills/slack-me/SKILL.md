---
name: slack-me
description: Send the user questions, decisions, or status updates over Slack instead of (or in addition to) the chat, and wait for their reply when input is needed. Use when the user says "Slack me", "Slack me with any questions or decisions", "ping me on Slack", or has asked to be contacted on Slack for the current task.
---

# Slack me

The user wants questions, decisions, and updates delivered to Slack. A Slack credential is injected automatically
for `https://slack.com/api/*` requests — never add an `Authorization` header and never ask for a token.

**Channel:** `#bruce-bot-collab` — `C0C7L8PR00H` (https://adobe.enterprise.slack.com/archives/C0C7L8PR00H). Only post there unless the
user names another channel.

## When this applies

Once the user says "Slack me with any questions or decisions" (or similar), it stays in effect for the rest of the
task: every time you would ask the user something or report a milestone, send it to Slack.

- **Question or decision needed** → post the message, then poll the thread for the reply and act on it.
- **Informational only** (progress, completion summary, FYI) → post the message and continue. Do not poll.

## Sending

Use the helper script (it posts, prints the message `ts`, and optionally waits for a reply):

```bash
# informational — post and continue
.claude/skills/slack-me/slack.sh post "Design migration finished: 4 blocks styled, ~95% match."

# question — post, then wait for the first threaded reply (prints the reply text)
.claude/skills/slack-me/slack.sh ask "Desktop header ready. Continue to mobile? Reply yes / no + changes."
```

Run `ask` with a Bash timeout of 600000 ms. It polls `conversations.replies` every 20 seconds for up to
~9 minutes. If it times out (exit code 2), run `.claude/skills/slack-me/slack.sh wait <ts>` to keep
waiting, and tell the user in chat that you're still waiting on Slack.

## Writing the message

- Lead with the decision or question; keep it short and scannable (Slack `mrkdwn`: `*bold*`, `•` bullets).
- For choices, number the options and say how to reply, e.g. "Reply 1, 2, or describe what you want."
- Include enough context to answer from a phone, without local paths, `localhost` URLs, or internal tool names.
- Never include secrets, tokens, or credentials in a message.
- Batch related questions into one message instead of sending several in a row.

## After a reply

- Quote the reply in the chat so the conversation has a record, then act on it.
- If the reply is unclear, ask a follow-up in the same thread (`slack.sh ask --thread <ts> "..."`).
- If a call fails with `not_authed`, `invalid_auth`, or a 401/403, the Slack credential isn't enabled: tell the user
  in chat and fall back to asking there. Do not ask for a token.
