# Skanare × MiroFish experiment

This folder is deliberately isolated from the production Skanare application.

MiroFish is a multi-agent simulation tool. It can be useful for **synthetic customer research**: generating persona reactions, objections, messaging risks and hypotheses before spending time or money on real-user studies.

It is **not a replacement for real customers** and it does not browse/click Skanare like an end-to-end QA bot. Use Playwright/manual testing for functional bugs and use actual users/analytics for conversion evidence.

## Why this experiment is useful for Skanare

Good questions for MiroFish:
- Does the dynamic-QR value proposition make sense?
- Who sees the strongest use case?
- What makes the product feel useful versus gimmicky?
- Does the price create objections?
- What privacy/security concerns appear?
- What causes hesitation around account creation, QR management, delivery and returns?
- Which messages should be tested with humans before launch?

Bad questions for MiroFish:
- "Does the checkout button actually work?"
- "Does Safari render this correctly?"
- "What is the real conversion rate?"
- "Will 18% of customers buy?"
- "Is this statistically representative of Greek consumers?"

Those require browser automation, analytics, usability sessions or real experiments.

## Isolation and licensing

The official MiroFish project is AGPL-3.0. This setup does **not copy or modify MiroFish source code** inside the Skanare app. It runs the official container as a separate local research tool.

Keep this local/private for experimentation. If MiroFish is ever modified, embedded in Skanare, or offered as a network service, review the AGPL obligations before doing that.

## Prerequisites

- Docker Desktop / Docker Engine
- an API key for an OpenAI-SDK-compatible LLM provider
- a Zep Cloud API key (required by the official upstream build used here)

Upstream warns that simulations can consume substantial LLM tokens, so start small.

## 1. Configure secrets

From this folder:

```bash
cp .env.example .env
```

Fill in:

```env
LLM_API_KEY=...
LLM_BASE_URL=...
LLM_MODEL_NAME=...
ZEP_API_KEY=...
```

Never commit `.env`.

## 2. Build a fresh Skanare seed from the live catalogue

From the repository root:

```bash
node experiments/mirofish/build-seed.mjs
```

It creates:

```text
experiments/mirofish/generated/skanare-live-seed.md
```

The seed is generated from the live `https://skanare.com/api/products` endpoint, so active products, titles, prices, stock and variants reflect the current storefront at the time of the run.

## 3. Start MiroFish

```bash
cd experiments/mirofish
docker compose up -d
```

Open:

```text
http://localhost:3100
```

Backend API is available locally on port `5101`.

This uses different host ports from Skanare so it does not collide with the existing app.

## 4. Create the first study

Upload:

```text
generated/skanare-live-seed.md
```

MiroFish accepts PDF, MD and TXT seed files.

For the simulation requirement/prompt, paste the contents of:

```text
study-prompt.txt
```

For the first run, keep the simulation intentionally small. The official project itself recommends starting below 40 rounds because model usage can be high.

## 5. How to interpret the result

Treat recurring patterns as **hypotheses**, not facts.

A useful result looks like:

- "Several creator/persona agents did not understand why the QR needs to be dynamic."
- "Price resistance was concentrated among casual buyers, while business/networking personas valued editability."
- "Trust concerns repeatedly focused on what happens if Skanare goes offline."

That should become a real test, e.g.:

- rewrite hero copy A/B test
- 5-person moderated usability test
- checkout task observation
- pre-launch landing-page ad experiment
- post-purchase interviews

Do **not** report a synthetic percentage as a market statistic.

## 6. Stop/remove the experiment

```bash
docker compose down
```

To also remove local experiment state:

```bash
docker compose down
rm -rf data generated results
```

## Recommended Skanare validation stack

Use MiroFish as only one layer:

1. **Automated functional tests** — browser/Playwright, APIs, CI.
2. **Synthetic customer simulation** — MiroFish for objections and hypotheses.
3. **Real usability testing** — 5–8 target users performing purchase tasks.
4. **Real behavioural data** — analytics/funnel/drop-off once traffic exists.
5. **A/B testing** — only after there is enough real traffic to make it meaningful.

The value of MiroFish here is speed: it can expose questions worth testing before recruiting real people. It should not be treated as proof that real people will behave the same way.
