Features

# Automations

**Automations** fires a chain of steps in response to a WhatsApp event. Use it for fire-and-forget reactions: auto-reply to a keyword, tag every new contact, create a deal when someone replies "yes", route VIPs to a specific agent.

If you need a **multi-step conversation** where the customer picks options and the bot branches based on their replies, use [Flows](https://wacrm.tech/docs/flows) instead. The two engines coexist — flows take precedence when both would match.

> **Cron required.** If your automation uses a **Wait** step, you need the drain cron set up. See [Automations cron](https://wacrm.tech/docs/automations-and-cron) for the endpoint contract.

## Layout

| Pane | What it shows |
| --- | --- |
| **List page** (`/automations`) | Cards for every automation: name, status (active toggle), trigger badge, last-run timestamp, execution count, kebab menu. |
| **Quick-start templates** | A grid of 4 starter templates (Welcome Message, Out of Office, Lead Qualifier, Follow-up Reminder) shown when you have fewer than 3 automations. |
| **Editor** (`/automations/[id]/edit`) | Trigger panel on top, linear step list below. Add / reorder / configure steps. |
| **Logs** (`/automations/[id]/logs`) | Per-execution table: which contact triggered it, which steps ran, status, error message if any. |

Toggle an automation on or off with the switch on its card — no edit page needed for a quick pause.

## The trigger

Every automation has exactly one trigger. Pick when you create:

| Trigger | Fires when | Useful for |
| --- | --- | --- |
| **New message received** | Any inbound text from a contact. | Auto-replies, sentiment routing. |
| **First inbound message** | The contact's first-ever inbound. | Welcome flows, onboarding sequences. |
| **Keyword match** | Inbound text matches one of N keywords. Case-insensitive `contains` by default; toggle exact match if needed. | `support` → escalation, `unsubscribe` → opt-out. |
| **New contact created** | A contact row was just added (manual, CSV import, or first inbound). | Auto-tag, lead enrichment. |
| **Conversation assigned** | A conversation's `assigned_agent_id` changed. | Notify the agent in Slack via webhook. |
| **Tag added** | A specific tag was applied to a contact. | Trigger upsell when `VIP` is added. |
| **Time-based** | Cron expression or daily `HH:mm`. | Daily digest, weekly reminders. |

Trigger config is JSON; the editor shows the appropriate form fields per trigger type.

## Step types

Eleven step types. Add as many as you want; they execute in order.

| Step | What it does |
| --- | --- |
| **Send message** | Free-form text. **Only valid inside the 24-hour customer-service window.** |
| **Send template** | Meta-approved template with variable fills. Works outside the 24h window. |
| **Add tag** | Add a tag to the triggering contact. |
| **Remove tag** | Remove a tag. |
| **Assign conversation** | Set `assigned_agent_id`. Either a specific agent OR round-robin across available agents. |
| **Update contact field** | Set a `contacts` column (name / email / company). |
| **Create deal** | Make a new deal in a pipeline + stage you choose, with optional value and assignee. |
| **Wait** | Pause for N minutes / hours / days. **Drains via the cron.** |
| **Condition** | Branch into a `yes` / `no` subtree. See below. |
| **Send webhook** | POST to an external URL with the triggering event payload. Useful for Slack / Discord notifications, CRM sync. |
| **Close conversation** | Set `status = closed` on the conversation. |

### Conditions

The only step that branches. A condition has:

- **Subject** — what to test: `contact_field`, `tag_presence`, `message_content`, or `time_of_day`.
- **Operator** — `equals`, `contains`, `starts_with`, `is_present`, `is_absent` (subject-dependent).
- **Value** — what to compare to.

If true, the `yes` subtree runs. Else the `no` subtree. Both subtrees can have their own steps (including nested conditions — no depth limit, but cyclic graphs aren't detected so don't make one).

Unlike [Flows](https://wacrm.tech/docs/flows), automation steps are a **linear chain plus condition subtrees** — not an arbitrary graph. You can't have step #5 jump back to step #2.

## Building an automation

1. **/automations** → **New automation** (or pick a template card for a head start).
2. **Name + describe** it. Internal-only.
3. **Pick the trigger.** Fill its config.
4. **Add steps.** Each step picks a type, then renders that type's config form. Drag a step to reorder.
5. **Toggle Active.** The automation is now live; subsequent matching events will fire it.

## The Wait step

The reason a cron is required. A Wait step pauses execution and parks the run in `automation_pending_executions` with a `due_at` timestamp. The cron drains rows where `due_at <= now()` and resumes them from the next step.

If you skip the cron, Wait-step automations never resume — every later step is stranded.

See [Automations cron](https://wacrm.tech/docs/automations-and-cron) for the endpoint, secret, and scheduler options (hPanel cron, UptimeRobot, GitHub Actions).

## The Logs page

Every execution writes an `automation_logs` row:

- `contact_id` — who triggered it.
- `trigger_event` — the payload that matched the trigger.
- `steps_executed` — JSON array of `{step_type, status, output?, error?}` in execution order.
- `status` — `success`, `partial` (some steps errored, others ran), `failed` (one step crashed before any others ran).
- `error_message` — first error, if any.

The Logs page renders this table with filters by status + date range. Click a row to expand the per-step detail — useful when an automation fires but the agent assignment goes to the wrong person, because you can see exactly which condition evaluated to which branch.

## Interaction with Flows

The webhook handler runs the Flow runner **first**, then dispatches automations. If a Flow `consumes` the inbound (advances an active run or starts a new one), automations keyed on `new_message_received` / `keyword_match` are **suppressed** for that inbound — the customer is navigating a bot menu, not sending a fresh trigger word.

Triggers about **who** (`new_contact_created`, `first_inbound_message`) still fire even when a Flow consumes the message — they care about the contact, not the message text.

If you find your automation isn't firing for a customer mid-Flow, that's why. Use a Flow `handoff` node to hand back to automations when the conversation should resume normally.

## Limits & notes

- **No cycle detection.** A chain like `step 1 → wait → condition → yes-branch → wait → step 1` will loop forever. The cron will re-fire the same row indefinitely. Don't.
- **Free-form `Send message` outside the 24h window fails.** Meta rejects the send and the step records as errored. Use `Send template` when the window is closed.
- **Webhook steps have no retry.** A 5xx from the external URL is logged as an error and the execution continues to the next step.
- **`update_contact_field` only works on the fixed schema.** You can't write to a column you've added yourself unless the engine knows about it (extend `src/lib/automations/steps/update-contact-field.ts`).
- **No transactional rollback.** If step 3 errors, steps 1 and 2 have already happened (tags applied, messages sent). Design with this in mind — put riskier steps later.
- **Counter is atomic.** `execution_count` updates via a SECURITY DEFINER RPC (migration 007), so concurrent triggers don't lose counts.

## Where to file bugs

[github.com/ArnasDon/wacrm/issues](https://github.com/ArnasDon/wacrm/issues), label `automations`.