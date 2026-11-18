import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Design tokens (shared with the strategy deck)
// ---------------------------------------------------------------------------
const T = {
  primary: "#E8432A",
  primaryDark: "#C7331D",
  ink: "#1A1A1A",
  n600: "#555555",
  n400: "#8A8A8A",
  n200: "#E5E5E5",
  bg: "#FFFFFF",
  bgSubtle: "#F7F5F3",
  tint: "#FDF1EE",
  tintBorder: "#F6D5CC",
  success: "#2E8B57",
  radius: 10,
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const NOTES = {
  edit: "Preview only — editing isn't wired up in this prototype.",
  claimed:
    "Claiming turns this into your real profile page — a link you can text to customers, post on Nextdoor, or add to your business card. (Not wired up in this prototype.)",
  share:
    "Once live, this generates a link to your profile you can send anywhere. (Not wired up in this prototype.)",
};

const QUESTIONS = [
  {
    id: "identity",
    text: "First, the basics — what's your name or business name, and the best phone number or email for customers to reach you?",
  },
  {
    id: "services",
    text: "What kind of jobs do you usually take on? (Drywall, TV mounting, fence repair, furniture assembly, whatever — just list what you do.)",
    validate: true,
    suggestions: [
      "Painting",
      "Fixture install",
      "Gutter cleaning",
      "Deck repair",
      "Appliance install",
      "Minor electrical",
      "Minor plumbing",
      "Caulking & sealing",
    ],
  },
  {
    id: "origin",
    text: "How'd you get into this work? Did you learn it from someone, fall into it, or just start fixing your own stuff first?",
  },
  {
    id: "area",
    text: "What part of Columbus do you cover? A ZIP code or neighborhood name is perfect.",
  },
  {
    id: "availability",
    text: "When are you usually free to take jobs — evenings, weekends, or do you also handle same-day/emergency stuff?",
  },
  {
    id: "brag_job",
    text: "Tell me about one job you did that you're actually proud of. Doesn't have to be a big one — could be something tricky you figured out, or a customer who was really happy.",
  },
  {
    id: "brag_edge",
    text: "Is there anything you do that most handymen around here don't — a specialty, a tool you're weirdly good with, something like that? Totally fine to skip this one if nothing comes to mind.",
    optional: true,
  },
  {
    id: "closer",
    text: "Last one — if a neighbor asked a friend \"Do you know a good handyman?\", what's the one sentence you'd want them to say about you?",
  },
];

// ---------------------------------------------------------------------------
// Claude call: uses the claude.ai page capability when published as an
// artifact, otherwise the local Vite dev proxy (see vite.config.js).
// ---------------------------------------------------------------------------
const MODEL = import.meta.env?.VITE_CLAUDE_MODEL || "claude-sonnet-4-6";

async function callClaude(systemPrompt, userPrompt) {
  const sample = window.claude?.use ? await window.claude.use("sample") : null;
  if (sample) {
    const res = await sample(`${systemPrompt}\n\n---\n\n${userPrompt}`);
    return res?.text ?? "";
  }
  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `API error ${response.status}`);
  }
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export default function App() {
  const [stage, setStage] = useState("landing"); // landing | intake | assembling | profile
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [showPreviewNote, setShowPreviewNote] = useState(false);
  const [note, setNote] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [chipTapped, setChipTapped] = useState(false);
  const [typedManually, setTypedManually] = useState(false);
  const [reminderShown, setReminderShown] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, checking]);

  function startIntake() {
    setStage("intake");
    setMessages([{ role: "ai", text: QUESTIONS[0].text }]);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  }

  function advanceToNext(updatedAnswers) {
    setAnswers(updatedAnswers);
    setRetryCount(0);
    setChipTapped(false);
    setTypedManually(false);
    setReminderShown(false);
    setPendingAnswer("");

    const nextIndex = qIndex + 1;
    if (nextIndex < QUESTIONS.length) {
      setQIndex(nextIndex);
      setMessages((m) => [...m, { role: "ai", text: QUESTIONS[nextIndex].text }]);
    } else {
      setStage("assembling");
      assembleProfile(updatedAnswers);
    }
  }

  function handleChipTap(term) {
    setChipTapped(true);
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return term;
      if (trimmed.toLowerCase().includes(term.toLowerCase())) return prev;
      return `${trimmed}, ${term}`;
    });
  }

  function skipQuestion() {
    const currentQ = QUESTIONS[qIndex];
    if (!currentQ.optional || checking) return;
    setMessages((m) => [...m, { role: "user", text: "(skipped)" }]);
    setInput("");
    advanceToNext({ ...answers, [currentQ.id]: "" });
  }

  async function submitAnswer() {
    const answer = input.trim();
    if (!answer || checking) return;

    const currentQ = QUESTIONS[qIndex];
    setMessages((m) => [...m, { role: "user", text: answer }]);

    if (currentQ.validate && retryCount < 1) {
      setChecking(true);
      try {
        const raw = await callClaude(
          "You check whether a short answer describes a home-services / handyman-type trade (e.g. repairs, installs, plumbing, electrical, carpentry, painting, assembly, general handyman work). Respond with ONLY JSON: {\"is_home_service\": true or false}. No other text.",
          `Answer: "${answer}"`
        );
        const parsed = parseJsonLoose(raw);
        const isHomeService = parsed ? parsed.is_home_service : true;

        if (!isHomeService) {
          setMessages((m) => [
            ...m,
            {
              role: "ai",
              text: "Hey, sounds like that's outside what our home services network covers right now — we're focused on stuff like repairs, installs, and handyman work. Want to try again with what you actually do?",
            },
          ]);
          setRetryCount((c) => c + 1);
          setChecking(false);
          setInput("");
          return;
        }
      } catch {
        // if the check fails, don't block the demo — proceed
      }
      setChecking(false);
    }

    if (currentQ.suggestions && chipTapped && !typedManually && !reminderShown) {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Good list! Feel free to add anything else in your own words, tap a few more suggestions, or hit Continue below when you're ready to move on.",
        },
      ]);
      setReminderShown(true);
      setPendingAnswer(answer);
      setInput(answer);
      return;
    }

    setInput("");
    advanceToNext({ ...answers, [currentQ.id]: answer });
  }

  function confirmContinue() {
    const finalAnswer = input.trim() || pendingAnswer;
    if (!finalAnswer) return;
    const currentQ = QUESTIONS[qIndex];
    setInput("");
    advanceToNext({ ...answers, [currentQ.id]: finalAnswer });
  }

  async function handleCopyReview() {
    try {
      await navigator.clipboard.writeText(profile?.reviewRequestMessage ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard access can fail in sandboxed contexts — don't block the demo
    }
  }

  async function assembleProfile(finalAnswers) {
    setError(null);
    try {
      const raw = await callClaude(
        `You write short, warm, plain-spoken provider profiles for a local home-services app. Not corporate, not salesy — sounds like a real Columbus handyman describing himself. If the specialty/edge answer is blank or says it was skipped, do NOT invent one — just lean more on the 'proud job' answer instead. Given the provider's own answers, produce ONLY JSON with this exact shape, no other text:
{
  "providerName": "the person's name or business name, pulled from their identity answer as plainly stated — don't invent one if unclear, just use their best-guess wording",
  "contactDisplay": "their phone number and/or email, formatted plainly and cleanly, separated by ' · ' if both are given",
  "bio": "2-4 sentence bio in first person, warm and specific, using at least one concrete detail from their 'proud job' answer (and their 'edge' answer only if it's actually provided)",
  "tags": ["3-6 short service tags in Title Case, extracted from their services answer"],
  "area": "their service area tightened into a short, natural display phrase (e.g. 'Columbus metro area & Akron', 'Clintonville & Worthington') — never first person, never vague filler like 'the general area'; if they were vague, default to 'Columbus metro area'",
  "availability": "their availability tightened into a short display phrase (e.g. 'Weekdays, with some flexibility', 'Evenings & weekends')",
  "reviewRequestMessage": "a short, friendly text message the provider can send a customer after a job asking for a review, starting 'Hi [Name],' and signed with the provider's first name"
}`,
        `Provider's answers:
Name/business name and contact info: ${finalAnswers.identity}
Services: ${finalAnswers.services}
How they got into it: ${finalAnswers.origin}
Service area: ${finalAnswers.area}
Availability: ${finalAnswers.availability}
Proud job: ${finalAnswers.brag_job}
Specialty/edge: ${finalAnswers.brag_edge ? finalAnswers.brag_edge : "(skipped — do not invent one)"}
Neighbor pitch: ${finalAnswers.closer}`
      );
      const parsed = parseJsonLoose(raw);
      if (!parsed) throw new Error("parse_failed");
      setProfile({
        ...parsed,
        area: parsed.area || finalAnswers.area,
        availability: parsed.availability || finalAnswers.availability,
      });
      setStage("profile");
    } catch {
      setError("Something went sideways putting the profile together. Try again?");
      setStage("intake");
    }
  }

  return (
    <div style={styles.page}>
      {stage === "landing" && (
        <div style={styles.centerCard}>
          <div style={styles.arrivalNote}>
            A personal invite — we're reaching out to a first group of
            Columbus-area pros.
          </div>
          <div style={styles.eyebrow}>Columbus Home Services</div>
          <h1 style={styles.h1}>Your virtual business card, ready in 5 minutes</h1>
          <p style={styles.subtext}>
            Answer a few quick questions and get a ready-to-share profile —
            the digital card you send when someone asks "do you know a good
            handyman?" No sign-up, no cost, no obligation.
          </p>
          <button style={styles.primaryBtn} onClick={startIntake}>
            Get started
          </button>
        </div>
      )}

      {stage === "intake" && (
        <div style={styles.chatWrap}>
          <div style={styles.chatHeader}>
            Question {Math.min(qIndex + 1, QUESTIONS.length)} of {QUESTIONS.length}
          </div>
          {error && <div style={styles.errorBanner}>{error}</div>}
          <div style={styles.chatScroll} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{ ...styles.bubble, ...(m.role === "ai" ? styles.bubbleAi : styles.bubbleUser) }}
              >
                {m.text}
              </div>
            ))}
            {checking && (
              <div style={{ ...styles.bubble, ...styles.bubbleAi, ...styles.thinking }}>thinking…</div>
            )}
          </div>
          <div style={styles.inputArea}>
            {QUESTIONS[qIndex]?.suggestions && (
              <div style={styles.chipRow}>
                {QUESTIONS[qIndex].suggestions.map((term) => (
                  <button
                    key={term}
                    type="button"
                    style={styles.chip}
                    onClick={() => handleChipTap(term)}
                    disabled={checking}
                  >
                    + {term}
                  </button>
                ))}
              </div>
            )}
            <div style={styles.inputRow}>
              <textarea
                style={styles.textInput}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setTypedManually(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer…"
                disabled={checking}
                autoFocus
                rows={2}
              />
              <button
                style={styles.sendBtn}
                type="button"
                onClick={submitAnswer}
                disabled={checking || !input.trim()}
              >
                Send
              </button>
            </div>
            <div style={styles.helperRow}>
              <span style={styles.helperText}>Enter to send · Shift+Enter for a new line</span>
              {QUESTIONS[qIndex]?.optional && (
                <button style={styles.skipLink} type="button" onClick={skipQuestion} disabled={checking}>
                  Skip this one
                </button>
              )}
              {reminderShown && (
                <button style={styles.continueLink} type="button" onClick={confirmContinue} disabled={checking}>
                  Continue →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {stage === "assembling" && (
        <div style={styles.centerCard}>
          <div style={styles.spinner} />
          <p style={styles.subtext}>Putting your profile together…</p>
        </div>
      )}

      {stage === "profile" && profile && (
        <div style={styles.profileStageWrap}>
          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>Your Profile Is Ready</h1>
            <p style={styles.pageSub}>
              Here's what we built from your answers — a profile customers
              see, and a message you send after every job to collect reviews.
            </p>
          </div>

          <div style={styles.profileScroll}>
            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabelRow}>
                <div style={styles.sectionLabel}>Before you're hired</div>
                <button style={styles.editLink} type="button" onClick={() => setNote("edit")}>
                  Edit
                </button>
              </div>
              <p style={styles.sectionDesc}>
                This is what a customer sees when they find you. Share it
                anywhere you'd normally hand out a business card.
              </p>
              <div style={styles.framedPreview}>
                <div style={styles.browserBar}>
                  <span style={styles.browserDot} />
                  <span style={styles.browserDot} />
                  <span style={styles.browserDot} />
                </div>
                <div style={styles.profileCard}>
                  <h2 style={styles.profileName}>{profile.providerName}</h2>
                  <div style={styles.contactLine}>{profile.contactDisplay}</div>
                  <p style={styles.profileBio}>{profile.bio}</p>
                  <div style={styles.tagRow}>
                    {profile.tags?.map((t, i) => (
                      <span key={i} style={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={styles.metaGrid}>
                    <div style={styles.metaItem}>
                      <div style={styles.metaLabel}>Service area</div>
                      <div style={styles.metaValue}>{profile.area}</div>
                    </div>
                    <div style={styles.metaItem}>
                      <div style={styles.metaLabel}>Availability</div>
                      <div style={styles.metaValue}>{profile.availability}</div>
                    </div>
                  </div>
                  <div style={styles.starsPlaceholder}>☆ ☆ ☆ ☆ ☆ (no reviews yet)</div>
                  <button style={styles.contactBtn} onClick={() => setShowPreviewNote(true)}>
                    Contact
                  </button>
                  {showPreviewNote && (
                    <div style={styles.previewNote}>
                      This is a preview only — not wired up to real messaging yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabel}>After you finish a job</div>
              <p style={styles.sectionDesc}>
                Text this to the customer once the work's done — it's how you
                start collecting the reviews that show up on your profile above.
              </p>
              <div style={styles.framedPreview}>
                <div style={styles.textThreadBar}>Text message</div>
                <div style={styles.reviewCard}>
                  <div style={styles.reviewLabelRow}>
                    <div style={styles.reviewLabel}>Message preview</div>
                    <button style={styles.copyBtn} type="button" onClick={handleCopyReview}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div style={styles.reviewBubble}>{profile.reviewRequestMessage}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.claimFooter}>
            {!claimed ? (
              <>
                <p style={styles.claimText}>Claim your profile so customers can book your services.</p>
                <button
                  style={styles.primaryBtn}
                  onClick={() => {
                    setClaimed(true);
                    setNote("claimed");
                  }}
                >
                  Claim and share profile
                </button>
              </>
            ) : (
              <>
                <p style={styles.claimText}>
                  You're live — share your profile anywhere new customers
                  might find you.
                </p>
                <div style={styles.claimActions}>
                  <span style={styles.claimedBadge}>Claimed ✓</span>
                  <button style={styles.primaryBtn} onClick={() => setNote("share")}>
                    Share it
                  </button>
                </div>
              </>
            )}
            {note && <div style={styles.previewNote}>{NOTES[note]}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const card = {
  background: T.bg,
  borderRadius: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: T.bgSubtle,
    fontFamily: T.font,
    color: T.ink,
    display: "flex",
    justifyContent: "center",
    padding: "24px 16px",
    boxSizing: "border-box",
  },
  centerCard: {
    ...card,
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    textAlign: "center",
    padding: "40px 28px",
  },
  arrivalNote: {
    fontSize: 12.5,
    color: "#7a6a5c",
    background: "#F6F0E9",
    border: "1px solid #EADDC9",
    borderRadius: T.radius,
    padding: "8px 12px",
    marginBottom: 18,
    lineHeight: 1.4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.6,
    color: T.primaryDark,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  h1: { fontSize: 24, fontWeight: 700, lineHeight: 1.3, margin: "0 0 12px", color: T.ink },
  subtext: { fontSize: 15, color: T.n600, lineHeight: 1.5, marginBottom: 24 },
  primaryBtn: {
    background: T.primary,
    color: "#fff",
    border: "none",
    borderRadius: T.radius,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: T.font,
    cursor: "pointer",
  },
  chatWrap: {
    ...card,
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    overflow: "hidden",
  },
  chatHeader: {
    padding: "14px 18px",
    fontSize: 13,
    color: T.n400,
    borderBottom: `1px solid ${T.n200}`,
    fontWeight: 600,
  },
  errorBanner: { background: "#fdecea", color: "#a33", fontSize: 13, padding: "8px 18px" },
  chatScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  bubble: { maxWidth: "80%", padding: "10px 14px", borderRadius: 14, fontSize: 14.5, lineHeight: 1.45 },
  bubbleAi: { background: "#F1EFEB", color: "#222", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleUser: { background: T.primary, color: "#fff", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  thinking: { fontStyle: "italic", color: "#999" },
  inputArea: { padding: 14, borderTop: `1px solid ${T.n200}` },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: {
    background: "#fff",
    border: `1px solid ${T.tintBorder}`,
    color: T.primaryDark,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: T.font,
    padding: "5px 11px",
    borderRadius: 999,
    cursor: "pointer",
  },
  inputRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  textInput: {
    flex: 1,
    border: "1px solid #ddd",
    borderRadius: T.radius,
    padding: "10px 12px",
    fontSize: 14.5,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    background: "#fff",
    color: T.ink,
    minHeight: 44,
    maxHeight: 160,
    lineHeight: 1.4,
    boxSizing: "border-box",
  },
  helperRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  helperText: { fontSize: 11.5, color: "#aaa", paddingLeft: 2 },
  skipLink: {
    background: "none",
    border: "none",
    color: T.primaryDark,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: "2px 4px",
    textDecoration: "underline",
  },
  continueLink: {
    background: "none",
    border: "none",
    color: T.primary,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: "2px 4px",
  },
  sendBtn: {
    background: T.primary,
    color: "#fff",
    border: "none",
    borderRadius: T.radius,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: T.font,
    cursor: "pointer",
    height: 44,
  },
  spinner: {
    width: 32,
    height: 32,
    margin: "0 auto 20px",
    border: "3px solid #eee",
    borderTopColor: T.primary,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  profileStageWrap: {
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    height: "86vh",
  },
  pageHeader: { paddingBottom: 12, marginBottom: 14, borderBottom: `1px solid ${T.n200}` },
  pageTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: T.ink },
  pageSub: { fontSize: 13, color: T.n600, lineHeight: 1.45, margin: 0 },
  profileScroll: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    paddingBottom: 16,
  },
  sectionBlock: { display: "flex", flexDirection: "column" },
  sectionLabelRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  sectionLabel: { fontSize: 12.5, fontWeight: 700, color: T.primaryDark, marginBottom: 4 },
  editLink: {
    background: "none",
    border: "none",
    color: T.primaryDark,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: T.font,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  sectionDesc: { fontSize: 12.5, color: T.n400, lineHeight: 1.45, margin: "0 0 10px" },
  framedPreview: {
    border: `1px solid ${T.n200}`,
    borderRadius: 14,
    overflow: "hidden",
    background: "#EFECE6",
  },
  browserBar: { display: "flex", gap: 5, padding: "8px 10px", background: "#E2DDD4" },
  browserDot: { width: 8, height: 8, borderRadius: "50%", background: "#C9C2B5", display: "inline-block" },
  textThreadBar: {
    fontSize: 11,
    fontWeight: 600,
    color: T.n400,
    padding: "8px 12px",
    background: "#E2DDD4",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  profileCard: { background: "#fff", padding: 24, textAlign: "center" },
  profileName: { fontSize: 19, fontWeight: 700, margin: "0 0 4px", color: T.ink },
  contactLine: { fontSize: 13, color: T.n400, marginBottom: 14 },
  profileBio: { fontSize: 14.5, color: "#333", lineHeight: 1.55, textAlign: "left", marginBottom: 14 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 18 },
  tag: {
    background: T.tint,
    color: T.primaryDark,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 999,
  },
  metaGrid: { display: "flex", gap: 12, textAlign: "left", marginBottom: 16 },
  metaItem: { flex: 1, background: T.bgSubtle, borderRadius: T.radius, padding: "10px 12px" },
  metaLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: T.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  metaValue: { fontSize: 13.5, color: "#333", lineHeight: 1.4 },
  starsPlaceholder: { fontSize: 13, color: "#aaa", marginBottom: 16 },
  contactBtn: {
    width: "100%",
    background: T.primary,
    color: "#fff",
    border: "none",
    borderRadius: T.radius,
    padding: 12,
    fontSize: 14.5,
    fontWeight: 600,
    fontFamily: T.font,
    cursor: "pointer",
  },
  previewNote: { marginTop: 10, fontSize: 12.5, color: T.n400, fontStyle: "italic", lineHeight: 1.45 },
  reviewCard: { background: "#fff", padding: 20 },
  reviewLabelRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reviewLabel: { fontSize: 12, fontWeight: 600, color: T.n400, textTransform: "uppercase" },
  copyBtn: {
    background: "none",
    border: `1px solid ${T.n200}`,
    borderRadius: 8,
    color: T.primaryDark,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: T.font,
    padding: "4px 10px",
    cursor: "pointer",
  },
  reviewBubble: {
    fontSize: 14,
    color: T.ink,
    lineHeight: 1.5,
    background: "#D9FDD3",
    borderRadius: "14px 14px 14px 2px",
    padding: "12px 14px",
    display: "inline-block",
    maxWidth: "100%",
  },
  claimFooter: {
    background: T.tint,
    border: `1px solid ${T.tintBorder}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 -2px 8px rgba(0,0,0,0.05)",
    flexShrink: 0,
  },
  claimText: { fontSize: 14, color: T.primaryDark, lineHeight: 1.5, margin: "0 0 14px" },
  claimActions: { display: "flex", gap: 14, alignItems: "center" },
  claimedBadge: { fontSize: 14, fontWeight: 600, color: T.success },
};
