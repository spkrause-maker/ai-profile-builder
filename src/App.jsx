import { useState, useRef, useEffect } from "react";

const CLAIM_NOTES = {
  claim:
    "Claiming turns this into your real profile page — a link you can text to customers, post on Nextdoor, or add to your business card. (Not wired up in this prototype.)",
  edit: "Preview only — editing isn't wired up in this prototype.",
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
    text: "Last one — if a neighbor asked a friend \"do you know a good handyman,\" what's the one sentence you'd want them to say about you?",
  },
];

// Calls go through the Vite dev-server proxy (see vite.config.js), which adds
// the API key server-side so it never ships to the browser.
const MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-sonnet-4-6";

async function callClaude(systemPrompt, userPrompt) {
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
  const textBlock = data.content?.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
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
  const [claimNote, setClaimNote] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [chipTapped, setChipTapped] = useState(false);
  const [typedManually, setTypedManually] = useState(false);
  const [reminderShown, setReminderShown] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
      // clipboard access can fail silently in some sandboxed contexts — no need to block the demo
    }
  }

  async function assembleProfile(finalAnswers) {
    setError(null);
    try {
      const raw = await callClaude(
        `You write short, warm, plain-spoken provider profiles for a local home-services app. Not corporate, not salesy — sounds like a real Columbus handyman describing himself. If the specialty/edge answer is blank or says it was skipped, do NOT invent one — just lean more on the 'proud job' answer instead. Given the provider's own answers, produce ONLY JSON with this exact shape, no other text:
{
  "providerName": "the person's name or business name, pulled from their identity answer as plainly stated — don't invent one if unclear, just use their best-guess wording",
  "contactDisplay": "their phone number or email, formatted plainly and cleanly, pulled from their identity answer",
  "bio": "2-4 sentence bio in first person, warm and specific, using at least one concrete detail from their 'proud job' answer (and their 'edge' answer only if it's actually provided)",
  "tags": ["3-6 short service tags extracted from their services answer"],
  "reviewRequestMessage": "a short, friendly text message template the provider can send a customer after a job, asking for a review, with a placeholder for the customer's name"
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
        area: finalAnswers.area,
        availability: finalAnswers.availability,
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
          <h1 style={styles.h1}>Get a page to send new customers — free, in 5 minutes</h1>
          <p style={styles.subtext}>
            Answer a few quick questions and get back a ready-to-share
            profile — the link you send when someone asks "do you know a
            good handyman?" No sign-up, no cost, no obligation.
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
                style={{
                  ...styles.bubble,
                  ...(m.role === "ai" ? styles.bubbleAi : styles.bubbleUser),
                }}
              >
                {m.text}
              </div>
            ))}
            {checking && (
              <div style={{ ...styles.bubble, ...styles.bubbleAi, ...styles.thinking }}>
                thinking…
              </div>
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
                <button
                  style={styles.continueLink}
                  type="button"
                  onClick={confirmContinue}
                  disabled={checking}
                >
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
          <div style={styles.profileScroll}>
            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabel}>Before you're hired</div>
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
                  <div style={styles.previewEyebrow}>Your profile preview</div>
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
                Text this to the customer once the work's done — it's how
                you start collecting the reviews that show up on your
                profile above.
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
            <p style={styles.claimText}>
              You're one of the first Columbus pros in our local network. As
              neighbors nearby start looking for help, profiles like yours
              are what they'll see.
            </p>
            <div style={styles.claimActions}>
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  setClaimed(true);
                  setClaimNote("claim");
                }}
              >
                {claimed ? "Claimed ✓" : "Claim it"}
              </button>
              <button style={styles.secondaryBtn} onClick={() => setClaimNote("edit")}>
                Edit it
              </button>
              <button
                style={claimed ? styles.secondaryBtn : styles.secondaryBtnDisabled}
                onClick={() => claimed && setClaimNote("share")}
                disabled={!claimed}
                title={!claimed ? "Claim your profile first to get a shareable link" : ""}
              >
                Share it
              </button>
            </div>
            {!claimed && (
              <div style={styles.helperText}>
                Claim your profile first — that's what creates the real,
                shareable page.
              </div>
            )}
            {claimNote && <div style={styles.previewNote}>{CLAIM_NOTES[claimNote]}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f5f3",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    justifyContent: "center",
    padding: "24px 16px",
    boxSizing: "border-box",
  },
  centerCard: {
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    textAlign: "center",
    background: "#fff",
    borderRadius: 16,
    padding: "40px 28px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  arrivalNote: {
    fontSize: 12.5,
    color: "#7a6a5c",
    background: "#f6f0e9",
    border: "1px solid #eaddc9",
    borderRadius: 10,
    padding: "8px 12px",
    marginBottom: 18,
    lineHeight: 1.4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "#9a4a2e",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 12px",
    color: "#1a1a1a",
  },
  subtext: {
    fontSize: 15,
    color: "#555",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  primaryBtn: {
    background: "#c1440e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#fff",
    color: "#c1440e",
    border: "1px solid #c1440e",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  chatWrap: {
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  chatHeader: {
    padding: "14px 18px",
    fontSize: 13,
    color: "#888",
    borderBottom: "1px solid #eee",
    fontWeight: 600,
  },
  errorBanner: {
    background: "#fdecea",
    color: "#a33",
    fontSize: 13,
    padding: "8px 18px",
  },
  chatScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  bubble: {
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: 14,
    fontSize: 14.5,
    lineHeight: 1.45,
  },
  bubbleAi: {
    background: "#f1efeb",
    color: "#222",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    background: "#c1440e",
    color: "#fff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  thinking: {
    fontStyle: "italic",
    color: "#999",
  },
  inputArea: {
    padding: 14,
    borderTop: "1px solid #eee",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    background: "#fff",
    border: "1px solid #e6cdb8",
    color: "#9a4a2e",
    fontSize: 12.5,
    fontWeight: 600,
    padding: "5px 11px",
    borderRadius: 999,
    cursor: "pointer",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14.5,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: 44,
    maxHeight: 160,
    lineHeight: 1.4,
    boxSizing: "border-box",
  },
  helperRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  helperText: {
    fontSize: 11.5,
    color: "#aaa",
    paddingLeft: 2,
  },
  skipLink: {
    background: "none",
    border: "none",
    color: "#9a4a2e",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: "2px 4px",
    textDecoration: "underline",
  },
  continueLink: {
    background: "none",
    border: "none",
    color: "#c1440e",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: "2px 4px",
  },
  sendBtn: {
    background: "#c1440e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    height: 44,
  },
  spinner: {
    width: 32,
    height: 32,
    margin: "0 auto 20px",
    border: "3px solid #eee",
    borderTopColor: "#c1440e",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  profileStageWrap: {
    width: "100%",
    maxWidth: 420,
    margin: "auto",
    display: "flex",
    flexDirection: "column",
    height: "80vh",
  },
  profileScroll: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    paddingBottom: 16,
  },
  sectionBlock: {
    display: "flex",
    flexDirection: "column",
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#5a3d2c",
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12.5,
    color: "#888",
    lineHeight: 1.45,
    marginBottom: 10,
  },
  framedPreview: {
    border: "1px solid #e2ddd4",
    borderRadius: 14,
    overflow: "hidden",
    background: "#efece6",
  },
  browserBar: {
    display: "flex",
    gap: 5,
    padding: "8px 10px",
    background: "#e2ddd4",
  },
  browserDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#c9c2b5",
    display: "inline-block",
  },
  textThreadBar: {
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    padding: "8px 12px",
    background: "#e2ddd4",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  profileCard: {
    background: "#fff",
    padding: 24,
    textAlign: "center",
  },
  previewEyebrow: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#aaa",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  profileName: {
    fontSize: 19,
    fontWeight: 700,
    margin: "0 0 4px",
    color: "#1a1a1a",
  },
  contactLine: {
    fontSize: 13,
    color: "#888",
    marginBottom: 14,
  },
  profileBio: {
    fontSize: 14.5,
    color: "#333",
    lineHeight: 1.55,
    textAlign: "left",
    marginBottom: 14,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 18,
  },
  tag: {
    background: "#f1efeb",
    color: "#7a3a22",
    fontSize: 12.5,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 999,
  },
  metaGrid: {
    display: "flex",
    gap: 12,
    textAlign: "left",
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
    background: "#f6f5f3",
    borderRadius: 10,
    padding: "10px 12px",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#9a4a2e",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 13.5,
    color: "#333",
    lineHeight: 1.4,
  },
  starsPlaceholder: {
    fontSize: 13,
    color: "#aaa",
    marginBottom: 16,
  },
  contactBtn: {
    width: "100%",
    background: "#c1440e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  previewNote: {
    marginTop: 10,
    fontSize: 12.5,
    color: "#888",
    fontStyle: "italic",
  },
  reviewCard: {
    background: "#fff",
    padding: 20,
  },
  reviewLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
  },
  copyBtn: {
    background: "none",
    border: "1px solid #ddd",
    borderRadius: 8,
    color: "#9a4a2e",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    cursor: "pointer",
  },
  reviewBubble: {
    fontSize: 14,
    color: "#1a1a1a",
    lineHeight: 1.5,
    background: "#d9fdd3",
    borderRadius: "14px 14px 14px 2px",
    padding: "12px 14px",
    display: "inline-block",
    maxWidth: "100%",
  },
  claimFooter: {
    background: "#fff5ef",
    border: "1px solid #f0d9c8",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 -2px 8px rgba(0,0,0,0.05)",
    flexShrink: 0,
  },
  claimText: {
    fontSize: 14,
    color: "#5a3d2c",
    lineHeight: 1.5,
    marginBottom: 14,
  },
  claimActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  secondaryBtnDisabled: {
    background: "#f2f2f2",
    color: "#bbb",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
  },
};
