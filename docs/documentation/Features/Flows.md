Features

# Flows

**Flows** is the second of two automation modules in `wacrm`. Where [Automations](https://wacrm.tech/docs/automations-and-cron) react to single events ("when a new message arrives, do X"), Flows lets you build **branching, button-driven WhatsApp conversations** — IVR-style menus your customer navigates by tapping interactive buttons or list rows.

A typical Flow:

- A customer messages your number with `support`.
- The Flow auto-sends a menu: *"What do you need? \[Track order\] \[Refund\] \[Talk to someone\]"*.
- They tap *Refund*.
- The Flow asks for their order number, captures it, looks up the customer's tags, and either replies with policy details or hands off to a human agent — depending on the answer.

The whole thing runs inside the webhook handler. No external worker, no extra deploy. Active for free, scales with your existing Meta Cloud API quota.

## When to use Flows vs Automations

|                      | Automations                               | Flows                                                       |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Best for             | Fire-and-forget reactions to events       | Multi-step conversations                                    |
| Customer interaction | One-way (you send, they receive)          | Two-way (taps + replies advance state)                      |
| State                | Stateless — every dispatch is independent | Stateful — each contact has at most one active run          |
| Branching            | Linear step list (with a Wait step)       | Per-node `next_node_key` graph                              |
| Capturing input      | No                                        | Yes — `collect_input` writes to `flow_runs.vars`            |
| Tag operations       | Yes                                       | Yes — `set_tag` node                                        |
| Cron needed?         | Yes (Wait-step drain)                     | Yes (stale-run sweep) — both reuse `AUTOMATION_CRON_SECRET` |

You can use both. Inbound messages run through the Flow runner first; if the runner consumes the message (advanced an active run or started a new one), automations that key off `new_message_received` / `keyword_match` are suppressed for that inbound so the customer doesn't get a Flow reply *and* an automation reply.

## Core concepts

### Flow

A named conversation tree, owned by your user account. Has a **trigger** (when does this flow start?), an **entry node** (where does it start?), and a **status** (`draft` / `active` / `archived`). Only `active` flows match inbound messages.

### Node

A single step in the conversation. Nine types:

| Type            | What it does                                                       | Customer sees                             |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| `start`         | Marks the entry point. Advances to its `next_node_key`.            | Nothing                                   |
| `send_message`  | Sends a plain text message, then auto-advances.                    | The text                                  |
| `send_buttons`  | Sends a button menu (1–3 buttons), then suspends.                  | Body text + tappable buttons              |
| `send_list`     | Sends a list menu (1–10 rows across 1–10 sections), then suspends. | Body text + "tap to expand" button → list |
| `collect_input` | Sends a prompt, captures the next text reply into a variable.      | The prompt                                |
| `condition`     | Branches on a captured var, contact tag, or contact field.         | Nothing                                   |
| `set_tag`       | Adds or removes a tag on the contact.                              | Nothing                                   |
| `handoff`       | Marks the conversation `pending` so a human picks it up.           | Nothing (silent handoff)                  |
| `end`           | Terminates the run cleanly.                                        | Nothing                                   |

**Auto-advancing** nodes (`start`, `send_message`, `condition`, `set_tag`) run inline without waiting for input. **Suspending** nodes (`send_buttons`, `send_list`, `collect_input`) park the run until the customer replies. **Terminal** nodes (`handoff`, `end`) end the run.

### Trigger

When does a new run start for a contact who isn't already in a flow? Three types:

- **Keyword** — any inbound text containing one of the configured keywords (case-insensitive contains by default). Use sparingly: one flow per keyword, otherwise the first match wins.
- **First inbound message** — the contact's first-ever inbound. Good for "Welcome to our shop" intros.
- **Manual** — never auto-starts. Reserved for v2 (manual / API-driven starts).

Only one flow can trigger per inbound. If two `active` flows would both match, the older one wins (creation-time order).

### Variables

The `collect_input` node writes the customer's text reply into `flow_runs.vars[<var_key>]`. Downstream nodes interpolate via `{{vars.email}}` syntax in their prompt text and handoff notes:

```
send_message: "Thanks {{vars.name}}, what's your email?"
collect_input (var_key=email): "Drop your email below"
send_message: "Got it — confirming your order to {{vars.email}}."
```

Missing vars render as the empty string. The interpolation is non-recursive: a customer can't smuggle their own `{{vars.X}}` through `collect_input` to escape into a template.

### Fallback policy

What happens when a customer types something unexpected on a suspending node — e.g. they reply with text on a `send_buttons` node instead of tapping. Default: re-send the prompt up to 2 times, then hand off to an agent. Configurable per flow via `fallback_policy` (JSON on the `flows` row); the cron sweep also marks runs as `timed_out` after 24h of no activity.

## Building a flow

### 1. Open the builder

Sidebar → **Flows** → **New flow**. You'll see a dialog with three template options (Welcome menu, FAQ bot, Lead capture) plus an "Or start blank" input.

Templates clone the whole node graph into your account in draft status — fastest way to get a feel for the shape of a flow.

### 2. Pick a trigger

The trigger panel at the top of the editor controls **when** the flow starts. For your first flow, pick **Keyword** and set one distinctive word (e.g., `menu` or `start`) so you can trigger it deliberately from a personal WhatsApp number.

### 3. Build the node graph

The node list lives below the trigger panel.

- Click **Add node** to append a new node, then expand it to fill in its config.
- Connect nodes by setting **Advances to** (or **If true → / If false →** on a condition) to point at the target node.
- Every node has a stable **node key** (auto-derived from the node type) used as the routing identifier. Visible under the per-node **Show advanced** toggle if you want to lock it.

The validator at the bottom of the page checks for missing trigger config, unreachable nodes, dangling next-pointers, etc. Clicking an issue jumps to + flashes the offending node.

### 4. Activate

Hit **Activate** in the header. The validator runs server-side again; if there are errors the API returns them so the builder can re-highlight. On success the flow's `status` flips to `active` and new inbound messages start matching it.

To pause without losing work: **Pause** (sets back to `draft`). To wipe permanently: **Delete** (hard-delete; active runs end abruptly).

## Templates

Three first-party templates ship with the module:

- **Welcome menu** (4 nodes) — keyword-triggered routing menu. Customer picks a topic from 3 buttons; each button leads to a different handoff with a tagged conversation.
- **FAQ bot** (7 nodes) — list-driven question picker; replies with the matching answer text and ends the run. Good for offloading the top 5 questions your team answers daily.
- **Lead capture** (6 nodes) — first-inbound-triggered. Asks for name → email → company, interpolates each into the next prompt, hands off to sales with the captured values in the agent note.

Clone any of them, edit copy, point the buttons/handoffs at your own tags or agents.

## Run history

`/flows/[id]/runs` shows the 50 most recent runs of a flow, newest first. Click a row to expand the per-step event timeline:

- `started` — run created.
- `node_entered` — runner advanced into a node.
- `message_sent` — an outbound message was dispatched to Meta.
- `reply_received` — customer replied. Includes the matched `reply_id` (for button taps) or `text_length` (for text). **Raw text is not stored** for PII reasons; only the length.
- `fallback_fired` — customer's reply didn't match; fallback policy fired (reprompt / handoff / end).
- `handoff`, `timeout`, `completed`, `error` — terminal events.

The events table is the source of truth for debugging "why didn't my flow advance?".

## The runtime

Every inbound webhook calls the runner before automations dispatch. The flow:

1.  Look up the contact's active run, if any.
2.  If there's an active run: idempotency-check the Meta message id against past `reply_received` events on that contact's runs; advance the current suspending node based on the reply.
3.  If there's no active run: scan the user's active flows for one whose trigger matches the inbound (keyword / first-inbound). Create a new `flow_runs` row and walk the entry node.
4.  Walk the auto-advance chain in memory (all of the flow's nodes are pre-loaded in one SELECT), executing each node's side effects (Meta sends, condition evaluations, tag writes) until reaching a suspending or terminal node.
5.  Persist `current_node_key` via an optimistic UPDATE so two concurrent webhooks for the same run collide cleanly.

The whole pipeline is synchronous inside the webhook handler. There's no queue, no retry — if a Meta send fails the run is marked `failed` and the cron sweep eventually evicts it.

## Stale-run sweep cron

Without a sweep, a customer who abandons a flow mid-conversation keeps their slot in the `idx_one_active_run_per_contact` partial unique index forever — blocking new triggers. The cron drains it.

```
GET /api/flows/cron
Header: x-cron-secret: <AUTOMATION_CRON_SECRET>
```

- Returns `{ "swept": <n> }` with how many runs were marked `timed_out` this pass.
- `503` if the env var isn't set.
- `401` if the header is missing or wrong.

Hit it on a schedule — once every 5 minutes is more than enough for the default 24h timeout. Re-uses the same `AUTOMATION_CRON_SECRET` as the automations drain ([see Automations cron](https://wacrm.tech/docs/automations-and-cron)) so operators only have one secret to provision.

> **One secret, two endpoints.** Provisioning the `AUTOMATION_CRON_SECRET` env var is enough; you don't need a separate `FLOWS_CRON_SECRET`. But you DO need two separate cron schedules, one per endpoint — they sweep different tables.

## Limits & known constraints

- **One active run per contact.** Enforced by a partial unique index. A customer mid-flow can't accidentally start a second one.
- **Max 3 buttons per `send_buttons` / 10 rows per `send_list`** — WhatsApp's own caps.
- **Validator runs at activate time only.** A draft flow with broken next-pointers will fail to activate but won't be flagged while editing — until you hit Activate and see the issues panel.
- **Cycle detection** — the runner has a hard 64-step safety cap per dispatch. A flow with a cycle that loops auto-advance nodes forever will fail the offending run with `advance_loop_overflow`. Use a suspending or terminal node in every loop.
- **Mid-edit reads.** Saving a flow does a delete-then-insert on its node rows. Not transactional. The runner is resilient — a missing node ends that run with `node_not_found` and the next inbound from the same contact starts fresh — but a flow with active runs and a half-saved graph can drop in-flight conversations. Save before high-volume hours.
- **Per-device theme.** The color-theme picker (Settings → Appearance) is `localStorage` -scoped; it doesn't sync across devices. The picker has nothing to do with Flows specifically — flagged here because the editor is rich and most users find the picker via this surface.

## Where to file bugs

[github.com/ArnasDon/wacrm/issues](https://github.com/ArnasDon/wacrm/issues), label `flows`.