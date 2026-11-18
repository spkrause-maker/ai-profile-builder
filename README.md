# AI Profile Builder

A conversational onboarding prototype that turns a local handyman's answers to eight plain-language questions into a ready-to-share profile page and a review-request text message, using Claude.

It was built as the supply-side piece of a product strategy for launching a home-services marketplace. The full strategy is in [`docs/strategy-deck.md`](docs/strategy-deck.md).

## The problem

Two-sided home-services marketplaces live or die on supply density, and the biggest drop-off on the supply side is the profile. Most handymen don't have a website, don't enjoy writing about themselves, and abandon long sign-up forms. A thin profile also hurts conversion on the demand side.

This prototype replaces the form with a short chat. It asks the questions a neighbor would ask, then writes the profile for them.

## How it works

1. **Landing:** a low-commitment pitch: a free page to send new customers, in five minutes.
2. **Conversational intake:** eight questions covering identity, services, background, service area, availability, a job they're proud of, an optional specialty, and how they'd want a neighbor to describe them.
   - Tap-to-add **suggestion chips** for services lower the effort of the hardest question.
   - An **LLM validation step** checks whether the services answer is actually a home-services trade and gently redirects once if not.
   - The specialty question is **skippable**, and the generation prompt is told not to invent one when it's skipped.
3. **Profile generation:** Claude returns structured JSON (name, contact line, first-person bio, service tags, review-request text), parsed defensively.
4. **Output:** two framed previews:
   - **Before you're hired:** the customer-facing profile page.
   - **After you finish a job:** a copyable text message asking the customer for a review.
5. **Claim:** the conversion moment. Claiming is what would turn the preview into a live, shareable page. (Claim, Edit, and Share are stubbed in this prototype.)

## Product decisions worth noting

- **Chat over form:** each question is answerable in a sentence on a phone; the model does the writing.
- **Pride-based prompts:** "a job you're proud of" produces specific, trustworthy bio details that generic forms don't.
- **Grounded generation:** the prompt pulls only from the provider's own answers and refuses to fabricate a specialty.
- **Reviews from day one:** the review-request template gives new providers a way to solve their own cold-start problem.

## Running locally

Requires Node 18+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

API calls go through the Vite dev-server proxy (`vite.config.js`), which attaches your key on the server side, so it's never exposed to the browser. This setup is for local demos only. A production deployment would need its own backend endpoint.

## Project structure

```
├── docs/
│   └── strategy-deck.md   # Launch strategy deck content (slides + speaker notes)
├── src/
│   ├── App.jsx            # The full prototype: intake flow, Claude calls, profile UI
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js         # Dev proxy to the Anthropic API
└── .env.example
```

## Status

Prototype. Built to demonstrate the onboarding flow and the generation quality, not production-hardened. No persistence, auth, or real messaging.
