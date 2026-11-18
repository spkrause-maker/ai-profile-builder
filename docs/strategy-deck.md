# Local AI Commerce: Home Services Launch Strategy

**Scott Krause** · Product strategy case study

> **Context:** This is a product strategy case study for a hyperlocal news platform with a large, location-aware reader base that wants to expand into local home-services commerce. The deck recommends where to start (category and geography), how to solve the marketplace cold-start problem, and how to measure the launch. The [AI Profile Builder prototype](../README.md) in this repo is the supply-side onboarding tool proposed on Slide 8.
>
> Slide content is kept at headline level; the reasoning behind each slide is in the **Notes**.

**Recommendation in one line:** Launch with **handyman services** in the **New Albany corridor** outside Columbus, OH, using a **capped-at-three transparent shared-lead model**, and solve supply first with an **AI-native profile builder**.

---

## 1. Title

**Local AI Commerce**
Home Services Vertical — Launch Recommendation: Handyman Services, New Albany Corridor

---

## 2. What the Platform Already Has vs. What's Missing

- A large local reader base = demand-side customer acquisition cost already largely solved — but the mechanism matters, not just the audience size
- Existing interest and intent tracking at ZIP+4 resolution — a level of granularity most platforms never bother with
- What's still open: supply density in a specific category, and a workflow that turns a reader into a repeat transacting customer

**Notes:** State the mechanism, not just the scale claim. The recommendation isn't "build the whole platform," it's "solve the one thing that's actually hard."

---

## 3. Columbus: Why Now

- Metro population ~1.76M, growing ~1%/year — but the New Albany/Intel corridor is projected to add ~725,000 residents / ~272,000 households over 25 years
- Housing supply can't keep up: ~12,000–13,000 homes/year delivered against an estimated need of 6,000–7,000 more annually
- Housing stock is aging (median home built 1980); homeowners now stay a record 11 years before selling — a repair-and-maintain market, not a flip-and-move market
- Labor is the real constraint, not demand: Intel's build alone is absorbing ~7,000 construction workers — the same labor pool the marketplace needs on the supply side

**Notes:** Demand for home services is about to spike in a specific corridor, right as the labor pool needed to serve it is being pulled toward Intel. The labor-shortage fact belongs here rather than in GTM — it does double duty.

---

## 4. Columbus: Where the Wedge Lives

- Homeownership is bifurcated: the city of Columbus is only 44% owner-occupied vs. 61% for the metro overall — the suburban ring is where owner-driven repair demand concentrates
- New Albany is the epicenter of both problems — the Intel jobs/housing-shortage zone and a homeowner-heavy suburb at once
- Home values rising steadily (~2.4% YoY, $327,500 median) — appreciating equity makes homeowners more willing to spend on repairs and upgrades
- Launch geography: the New Albany corridor (Franklin/Licking County line) — not Columbus city proper, not the full nine-county metro

**Notes:** Start where owner-occupied housing, aging housing stock, and Intel-driven population growth all stack on top of each other. Every later slide (GTM supply radius, metrics catchment, expansion) means this same geography when it says "the corridor."

---

## 5. Competitive Landscape

- Angi, Thumbtack, HomeAdvisor, Yelp, Nextdoor, and Google Local Services Ads mapped by trust vs. scale vs. workflow quality
- Incumbents compete hardest where lead-selling economics are best — licensed trades (plumbing, electrical, HVAC)
- That leaves fragmented, low-differentiation categories comparatively underserved by structured platforms
- The real gap: a marketplace that's high-trust AND handles both sides' workflow — not just lead-gen

**Notes:** Sets up why the wedge isn't a licensed trade — incumbents already fight hardest there. The gap is elsewhere.

---

## 6. What We'd Build First: Handyman Services

- **Labor supply:** licensed trades require multi-year apprenticeships and compete directly with Intel's ~7,000 construction workers — the hardest category to build supply density in first. Handyman work has a lower licensing barrier, faster onboarding, and a wider labor pool
- **Demand shape:** aging housing stock + a wave of new Intel-driven households = a steady stream of small recurring jobs (mounting, patching, punch-list work) — immediate move-in demand, not a later replacement cycle
- **Competitive gap:** handyman is comparatively underserved by structured platforms despite being a high-trust category (someone is in your house for a $150 job)
- **Lead-model fit:** handyman jobs are overwhelmingly planned and non-emergency — a clean fit for a capped-at-three shared-lead model, simpler for v1 than urgent-dispatch logic
- **Personal credibility:** direct precedent launching a handyperson category from zero at Romio

**Notes:** Preempt the obvious counterargument — handyman has a lower average ticket than HVAC/electrical. The answer is sequencing: handyman is the liquidity-and-trust wedge, not the monetization ceiling. Licensed-trade expansion is the natural second move once density and reputation are established.

---

## 7. Key Hypotheses

- **Demand:** hyperlocal NLP and geospatial tech can detect local intent signals already flowing through existing content — a burst-pipe story, a weather event, a home-price post — and route them into a service flow. A zero-marginal-cost demand trigger competitors don't have
- **Supply:** local providers will onboard if the workflow removes their administrative friction
- **Liquidity:** name the minimum viable supply density (e.g., "X qualified providers within a Y-mile radius") needed before turning on any demand-side push

**Notes:** The demand hypothesis is sharper than generic "AI intake" — it's specifically about routing existing content signal into a service flow using infrastructure the platform already owns.

---

## 8. The Product & Prototype

- **AI-native intake:** hyperlocal NLP resolving unstructured input to precise geography + job category — redirecting infrastructure that already exists, not building from scratch
- **Lead model v1:** capped-at-three transparent shared leads, fitting handyman's planned/non-emergency nature — exclusive urgent routing scoped as a future extension, not v1
- **Prototype — AI Profile Builder:** a conversational intake turns a handyman's answers into a ready-to-use profile, removing the biggest supply-side drop-off point that competitors leave unsolved
- **The conversion moment:** claiming turns the preview into a real, shareable profile page — a link providers can text to customers, post on Nextdoor, or add to a business card

**Notes:** The Claim button does the real persuading — it's the conversion point in the GTM story, so say the payoff out loud ("this becomes your real profile page"), not just "here's a prototype." See the [prototype README](../README.md) to run it.

---

## 9. GTM: Supply

- Founding-cohort editorial seeding for credibility — small, and intentionally not a scale mechanism
- Algorithmic surfacing as the actual scale mechanism once density exists
- Precedent: Angie's List's own Columbus-origin door-to-door model — same city, same category ancestor
- Precedent: Thumbtack's Craigslist cross-posting tool — meet providers where they already are
- Precedent: Airbnb's professional-photography unlock — investing in profile quality, not just lead volume, pays off
- Don't spend demand dollars until qualified density exists

**Notes:** Precedents are cited inline as credibility for the tactics, not as a standalone case-study slide.

---

## 10. GTM: Demand

- Demand activation is a lever pulled from the existing local reader base — not paid acquisition
- Proven infrastructure (interest/intent tracking, a large local audience) pointed at a new use case (service flow) — a lower-risk GTM bet than most marketplace demand plays
- Be explicit: the same tech does NOT prove supply-side matching quality — that's marketplace-ops execution, not the platform's AI

**Notes:** This is where honesty about "proven vs. hypothesis" matters most. Proven demand tech paired with marketplace-ops experience on the unproven supply side is the core of the plan.

---

## 11. Metrics to Evaluate the Launch

- A small, defensible handful — not a dashboard
- **Supply:** qualified providers onboarded, response/quote time
- **Demand:** intake-to-quote conversion, quote-to-booking conversion
- **Liquidity:** jobs completed per provider per week, geographic density threshold met

**Notes:** Ties back to the core marketplace health metrics: conversion, liquidity, retention, and take rate.

---

## 12. Close

- Reiterate the wedge: handyman services, New Albany corridor
- What I'm most confident about
- What I'd want to validate first

**Notes:** A confidence-plus-humility beat, not new content.

---

## Appendix A. Expansion Strategy

- Sequencing: funnel depth → segment → geography
- Each stage gated by hitting density/retention thresholds before expanding further
- Licensed trades (plumbing, electrical, HVAC) are the natural second category once handyman density and reputation are established

---

## Appendix B. Marketplace Cold-Start Precedents

- **Angie's List:** Columbus-origin, door-to-door review collection as the founding model
- **Thumbtack:** Craigslist cross-posting tool for low-friction provider acquisition
- **Yelp:** database seeding for early content density
- **Airbnb:** professional photography to build consumer trust at scale
- **DoorDash, Rover, Etsy:** adjacent two-sided marketplace bootstrapping plays
