import { useState, useRef, useEffect } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────
const FREE_LIMIT  = 3;
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL   = (key) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const LANGUAGES = [
  { code:"en", native:"English"  },
  { code:"hi", native:"हिंदी"    },
  { code:"mr", native:"मराठी"    },
  { code:"te", native:"తెలుగు"   },
  { code:"bn", native:"বাংলা"    },
  { code:"ta", native:"தமிழ்"    },
  { code:"gu", native:"ગુજરાતી"  },
];

const FORM_TYPES = [
  { id:"govt",        label:"Government Exam",       icon:"🏛️", accent:"#f0a500", desc:"SSC, UPSC, Railways, Bank PO, State PSC" },
  { id:"private",     label:"Private / Entrance",    icon:"🎓", accent:"#4caf7d", desc:"JEE, NEET, CAT, GATE, CLAT, MBA" },
  { id:"feedback",    label:"Feedback / Survey",     icon:"📝", accent:"#9c6fff", desc:"Govt portals, College, Hospital" },
  { id:"scholarship", label:"Scholarship / Welfare", icon:"💰", accent:"#ff6b6b", desc:"NSP, PM schemes, State welfare" },
];

// ─── STORAGE (works in artifact + browser) ─────────────────────────
const Store = {
  async get(k) {
    try {
      if (typeof window.storage !== "undefined") {
        const r = await window.storage.get(k); return r ? r.value : null;
      }
      return localStorage.getItem(k);
    } catch { return localStorage.getItem(k); }
  },
  async set(k, v) {
    try {
      if (typeof window.storage !== "undefined") { await window.storage.set(k, v); return; }
      localStorage.setItem(k, v);
    } catch { try { localStorage.setItem(k, v); } catch {} }
  },
};

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────
const buildPrompt = (lang) => `You are FormSathi — a friendly, expert AI assistant that helps Indian citizens fill forms step by step.

CRITICAL: ALWAYS respond in ${lang}. Even if the user writes in another language, YOU must reply in ${lang}.

PERSONALITY: Warm, patient, encouraging. Use very simple words. Never use jargon.
Mark valid answers with ✅. Mark errors with ⚠️.

VALIDATION — check EVERY answer before moving to the next field:
- Full Name: letters and spaces only, minimum 3 chars, NO numbers
- Date of Birth: DD/MM/YYYY format only. Year must be between 1940 and 2010.
- Mobile Number: exactly 10 digits. Must start with 6, 7, 8, or 9.
- Email: must contain @ and a dot after the @
- PIN Code: exactly 6 digits. No letters.
- Aadhaar Number: exactly 12 digits.
- Category (General/OBC/SC/ST/EWS): explain what each means simply before asking.

IF INVALID → Start reply with "⚠️" + explain why in simple words + ask again.
IF VALID   → Start reply with "✅" + confirm the answer + ask the next field.

GUIDANCE RULES:
1. Ask ONE field at a time. Never ask two questions together.
2. Before asking each field: explain what it means in 1 simple sentence + give an example.
3. Photo upload → say: JPEG, white background, 3.5×4.5 cm, max 50KB
4. Signature → say: black ink, white paper, JPEG, max 30KB
5. Always warn about common mistakes people make.

SUMMARY COMMAND: When user sends exactly "GENERATE_SUMMARY", reply with ONLY this JSON (no text before/after, no markdown backticks):
{"formName":"full form name","fields":[{"label":"field name","value":"user answer","valid":true}],"documents":["document 1"],"warnings":["warning 1"],"nextStep":"what to do next"}`;

// ─── CONVERT MESSAGES TO GEMINI FORMAT ────────────────────────────
function toGeminiContents(messages) {
  return messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: Array.isArray(m.content)
      ? m.content.map(c => {
          if (c.type === "text")  return { text: c.text };
          if (c.type === "image") return { inlineData: { mimeType: c.source.media_type, data: c.source.data } };
          return { text: "" };
        })
      : [{ text: m.content || "" }],
  }));
}

// ─── GEMINI API CALL ───────────────────────────────────────────────
async function callGemini(messages, system, apiKey) {
  if (!apiKey) throw new Error("Please add your Gemini API key in Settings.");

  let res;
  try {
    res = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: toGeminiContents(messages),
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      }),
    });
  } catch (e) {
    throw new Error("Network error — check your internet connection and try again.");
  }

  let data;
  try { data = await res.json(); } catch { throw new Error(`Server error (${res.status})`); }

  if (data.error) {
    const code = data.error.code;
    if (code === 400) throw new Error("Invalid request. Please try again.");
    if (code === 401 || code === 403) throw new Error("Invalid API key. Please check your Gemini API key in Settings.");
    if (code === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    throw new Error(data.error.message || "Gemini API error. Please try again.");
  }
  if (!res.ok) throw new Error(`Request failed (${res.status}). Please try again.`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from AI. Please try again.");
  return text;
}

function errMsg(err) { return `⚠️ ${err?.message || "Unknown error. Please try again."}`; }

// ══════════════════════════════════════════════════════════════════
//  PROFILE / API KEY SCREEN
// ══════════════════════════════════════════════════════════════════
function ProfileScreen({ onSave }) {
  const [name,   setName]   = useState("");
  const [lang,   setLang]   = useState(LANGUAGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={P.page}>
      <div style={P.card}>
        <div style={{ fontSize:"52px", marginBottom:"12px" }}>📋</div>
        <div style={P.title}>FormSathi</div>
        <div style={P.sub}>AI Form Filling Assistant · Powered by Gemini</div>

        {/* Name */}
        <label style={P.lbl}>YOUR NAME</label>
        <input style={P.inp} placeholder="e.g. Rahul Kumar" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key==="Enter" && name.trim() && apiKey.trim() && onSave(name.trim(), lang, apiKey.trim())} />

        {/* Language */}
        <label style={P.lbl}>PREFERRED LANGUAGE</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"24px" }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l)}
              style={{...P.lb, ...(lang.code===l.code ? P.lba : {})}}>{l.native}</button>
          ))}
        </div>

        {/* Gemini API Key */}
        <label style={P.lbl}>
          GEMINI API KEY &nbsp;
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
            style={{ color:"#4caf7d", fontSize:"10px", textDecoration:"none", fontWeight:"bold" }}>
            → Get FREE key here
          </a>
        </label>
        <div style={{ position:"relative", marginBottom:"8px" }}>
          <input
            style={{...P.inp, marginBottom:0, paddingRight:"48px", fontFamily:"monospace", fontSize:"13px"}}
            type={showKey ? "text" : "password"}
            placeholder="Paste your Gemini API key (AIza...)"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <button onClick={() => setShowKey(!showKey)}
            style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#4a5a7a", fontSize:"16px" }}>
            {showKey ? "🙈" : "👁️"}
          </button>
        </div>
        <p style={{ color:"#3a4a6a", fontSize:"11px", marginBottom:"24px", lineHeight:"1.6" }}>
          💡 Your key is stored only on your device. It is never shared with anyone.
          <br />Get a free key at <strong style={{ color:"#4caf7d" }}>aistudio.google.com</strong> → Sign in → Get API Key
        </p>

        <button
          style={{...P.go, opacity:(name.trim() && apiKey.trim()) ? 1 : 0.4, cursor:(name.trim() && apiKey.trim()) ? "pointer" : "not-allowed"}}
          onClick={() => name.trim() && apiKey.trim() && onSave(name.trim(), lang, apiKey.trim())}
          disabled={!name.trim() || !apiKey.trim()}>
          Get Started →
        </button>
        <p style={{ color:"#2a3555", fontSize:"12px", marginTop:"18px" }}>🔒 Everything stays on your device. Nothing is shared.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════════════════════════════
function HomeScreen({ profile, sessions, usageCount, language, onStart, onResume, onLangChange, onImgUpload, onOpenSettings }) {
  const freeLeft = Math.max(0, FREE_LIMIT - usageCount);
  const imgRef = useRef(null);

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117" }}>
      <div style={{ maxWidth:"860px", margin:"0 auto", padding:"24px 20px 48px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <span style={{ fontSize:"30px" }}>📋</span>
            <div>
              <div style={{ fontWeight:"bold", fontSize:"24px", background:"linear-gradient(135deg,#4caf7d,#00bcd4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>FormSathi</div>
              <div style={{ color:"#4a5a7a", fontSize:"13px" }}>Namaste, {profile?.name} 🙏</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            <select value={language.code} onChange={e => onLangChange(LANGUAGES.find(l => l.code===e.target.value))}
              style={{ background:"#161b27", border:"1px solid #2a3555", color:"#e0e4f0", borderRadius:"8px", padding:"6px 10px", fontSize:"13px", cursor:"pointer" }}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
            <div style={{ background:"#161b27", border:`1px solid ${freeLeft>0?"#4caf7d44":"#ff6b6b44"}`, color:freeLeft>0?"#4caf7d":"#ff6b6b", borderRadius:"8px", padding:"6px 12px", fontSize:"12px", fontFamily:"monospace" }}>
              {freeLeft>0 ? `${freeLeft}/3 free sessions left` : "⭐ Upgrade to Pro"}
            </div>
            <button onClick={onOpenSettings}
              style={{ background:"#161b27", border:"1px solid #2a3555", color:"#7a8499", borderRadius:"8px", padding:"6px 10px", cursor:"pointer", fontSize:"16px" }}
              title="Settings / Change API Key">⚙️</button>
          </div>
        </div>

        {/* Gemini Badge */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"#0a1f14", border:"1px solid #4caf7d44", borderRadius:"10px", padding:"8px 16px", marginBottom:"20px" }}>
          <span style={{ fontSize:"18px" }}>✨</span>
          <span style={{ color:"#4caf7d", fontSize:"13px", fontFamily:"monospace" }}>Powered by Google Gemini 2.0 Flash — 100% Free API</span>
        </div>

        {/* Image Upload Hero */}
        <div style={{ background:"linear-gradient(135deg,#080e1e,#0a1628)", border:"1px solid #00bcd433", borderRadius:"18px", padding:"24px 28px", marginBottom:"28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ flex:1 }}>
            <div style={{ color:"#00bcd4", fontSize:"11px", fontWeight:"bold", letterSpacing:"2px", marginBottom:"8px", fontFamily:"monospace" }}>✨ WOW FEATURE</div>
            <h2 style={{ color:"#e0e4f0", fontSize:"20px", marginBottom:"8px", fontWeight:"bold" }}>Upload Any Form — AI Reads It!</h2>
            <p style={{ color:"#4a5a7a", fontSize:"13px", lineHeight:"1.65", marginBottom:"18px", maxWidth:"480px" }}>
              Take a photo or screenshot of any form. FormSathi identifies every field and guides you automatically — in your language.
            </p>
            <label style={{ display:"inline-block", background:"#00bcd4", color:"#000", borderRadius:"10px", padding:"10px 20px", fontSize:"14px", fontWeight:"bold", cursor:"pointer" }}>
              📸 Upload Form Image
              <input ref={imgRef} type="file" accept="image/*" style={{ display:"none" }} onChange={onImgUpload} />
            </label>
          </div>
          <span style={{ fontSize:"64px", opacity:"0.12", marginLeft:"20px", flexShrink:0 }}>📸</span>
        </div>

        {/* Form Type Cards */}
        <div style={{ color:"#3a4a6a", fontSize:"12px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", marginBottom:"12px" }}>Or choose a form category:</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))", gap:"14px", marginBottom:"32px" }}>
          {FORM_TYPES.map(ft => (
            <button key={ft.id}
              style={{ background:"#0e1420", border:"1px solid #1e2840", borderRadius:"14px", padding:"20px 16px", cursor:"pointer", textAlign:"left", transition:"all 0.2s", position:"relative" }}
              onClick={() => onStart(ft)}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=`0 10px 32px ${ft.accent}44`; e.currentTarget.style.borderColor=`${ft.accent}88`; }}
              onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; e.currentTarget.style.borderColor="#1e2840"; }}>
              <div style={{ height:"3px", width:"40px", borderRadius:"2px", background:ft.accent, marginBottom:"14px" }} />
              <span style={{ fontSize:"30px", display:"block", marginBottom:"10px" }}>{ft.icon}</span>
              <div style={{ fontSize:"14px", fontWeight:"bold", color:ft.accent, marginBottom:"6px", fontFamily:"monospace" }}>{ft.label}</div>
              <div style={{ fontSize:"12px", color:"#4a5a7a", lineHeight:"1.55" }}>{ft.desc}</div>
              {usageCount>=FREE_LIMIT && <div style={{ position:"absolute", top:"10px", right:"10px", background:"#1e2840", color:"#4a5a7a", borderRadius:"6px", padding:"3px 8px", fontSize:"10px" }}>🔒 Pro</div>}
            </button>
          ))}
        </div>

        {/* Past Sessions */}
        {sessions.length > 0 && (
          <div>
            <div style={{ color:"#3a4a6a", fontSize:"12px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", marginBottom:"12px" }}>📂 Continue where you left off:</div>
            {sessions.map(s => (
              <button key={s.id}
                style={{ width:"100%", background:"#0e1420", border:"1px solid #1e2840", borderRadius:"12px", padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:"12px", marginBottom:"8px", transition:"background 0.15s" }}
                onClick={() => onResume(s)}
                onMouseEnter={e => e.currentTarget.style.background="#1a2035"}
                onMouseLeave={e => e.currentTarget.style.background="#0e1420"}>
                <span style={{ fontSize:"20px" }}>{s.icon}</span>
                <div style={{ flex:1, textAlign:"left" }}>
                  <div style={{ color:"#e0e4f0", fontSize:"14px", marginBottom:"2px" }}>{s.type}</div>
                  <div style={{ color:"#3a4a6a", fontSize:"12px", fontFamily:"monospace" }}>{s.date} · {s.msgs} messages · {s.lang}</div>
                </div>
                <span style={{ color:"#4caf7d", fontSize:"12px", fontWeight:"bold", fontFamily:"monospace", whiteSpace:"nowrap" }}>Resume →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SETTINGS MODAL
// ══════════════════════════════════════════════════════════════════
function SettingsModal({ profile, onSave, onClose }) {
  const [name,    setName]    = useState(profile?.name || "");
  const [apiKey,  setApiKey]  = useState(profile?.apiKey || "");
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:"16px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#0e1420", border:"1px solid #1e2840", borderRadius:"20px", padding:"28px 26px", maxWidth:"440px", width:"100%" }}>
        <h2 style={{ color:"#e0e4f0", fontSize:"20px", fontWeight:"bold", marginBottom:"20px" }}>⚙️ Settings</h2>

        <label style={P.lbl}>YOUR NAME</label>
        <input style={{...P.inp, marginBottom:"20px"}} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />

        <label style={P.lbl}>
          GEMINI API KEY &nbsp;
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
            style={{ color:"#4caf7d", fontSize:"10px", textDecoration:"none" }}>→ Get FREE key here</a>
        </label>
        <div style={{ position:"relative", marginBottom:"8px" }}>
          <input style={{...P.inp, marginBottom:0, paddingRight:"48px", fontFamily:"monospace", fontSize:"13px"}}
            type={showKey?"text":"password"} value={apiKey} onChange={e=>setApiKey(e.target.value)}
            placeholder="AIza..." />
          <button onClick={()=>setShowKey(!showKey)}
            style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#4a5a7a", fontSize:"16px" }}>
            {showKey?"🙈":"👁️"}
          </button>
        </div>
        <p style={{ color:"#3a4a6a", fontSize:"11px", marginBottom:"24px", lineHeight:"1.6" }}>
          Free at <strong style={{ color:"#4caf7d" }}>aistudio.google.com</strong> → API Keys → Create API key
        </p>

        <div style={{ display:"flex", gap:"10px" }}>
          <button style={{ flex:1, background:"#4caf7d", color:"#000", border:"none", borderRadius:"10px", padding:"12px", fontWeight:"bold", cursor:"pointer", fontSize:"14px" }}
            onClick={() => name.trim() && apiKey.trim() && onSave(name.trim(), apiKey.trim())}>
            Save Changes
          </button>
          <button style={{ background:"#161b27", border:"1px solid #2a3555", color:"#7a8499", borderRadius:"10px", padding:"12px 16px", cursor:"pointer", fontSize:"14px" }}
            onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SUMMARY MODAL
// ══════════════════════════════════════════════════════════════════
function SummaryModal({ data, accent, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000c", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:"16px" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#0e1420", border:"1px solid #1e2840", borderRadius:"20px", padding:"28px 26px", maxWidth:"620px", width:"100%", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"20px" }}>
          <div>
            <h2 style={{ fontSize:"22px", fontWeight:"bold", color:accent, marginBottom:"4px" }}>📋 Form Summary</h2>
            <p style={{ color:"#4a5a7a", fontSize:"13px" }}>{data.formName}</p>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button style={{ background:accent, color:"#000", border:"none", borderRadius:"10px", padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }} onClick={() => window.print()}>🖨️ Print</button>
            <button style={{ background:"#161b27", border:"1px solid #2a3555", color:"#6a7a9a", borderRadius:"10px", padding:"8px 13px", cursor:"pointer" }} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ color:"#3a4a6a", fontSize:"11px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", marginBottom:"10px" }}>✍️ Your Answers</div>
        <div style={{ border:"1px solid #1e2840", borderRadius:"12px", overflow:"hidden", marginBottom:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 70px", padding:"9px 14px", background:"#161b27", color:"#3a4a6a", fontSize:"11px", fontFamily:"monospace" }}>
            <span>Field</span><span>Your Answer</span><span style={{ textAlign:"center" }}>Status</span>
          </div>
          {(data.fields||[]).map((f,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 70px", padding:"10px 14px", borderTop:"1px solid #1e2840", background:i%2===0?"#0e1420":"#161b27", alignItems:"center" }}>
              <span style={{ color:"#c0c8e0", fontSize:"13px" }}>{f.label}</span>
              <span style={{ color:"#8899bb", fontSize:"13px" }}>{f.value||"—"}</span>
              <span style={{ textAlign:"center", fontSize:"16px" }}>{f.valid?"✅":"⚠️"}</span>
            </div>
          ))}
        </div>

        {(data.documents||[]).length>0 && <>
          <div style={{ color:"#3a4a6a", fontSize:"11px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", marginBottom:"10px" }}>📁 Documents to Carry</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"7px", marginBottom:"20px" }}>
            {data.documents.map((d,i) => (
              <label key={i} style={{ display:"flex", alignItems:"center", color:"#c0c8e0", fontSize:"14px", padding:"9px 13px", background:"#161b27", borderRadius:"8px", cursor:"pointer" }}>
                <input type="checkbox" style={{ marginRight:"10px", accentColor:accent }} />{d}
              </label>
            ))}
          </div>
        </>}

        {(data.warnings||[]).length>0 && <>
          <div style={{ color:"#3a4a6a", fontSize:"11px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", marginBottom:"10px" }}>⚠️ Reminders</div>
          {data.warnings.map((w,i) => (
            <div key={i} style={{ background:"#ff6b6b0e", border:"1px solid #ff6b6b2a", borderRadius:"8px", padding:"10px 14px", color:"#ff8a65", fontSize:"13px", marginBottom:"7px", lineHeight:"1.5" }}>{w}</div>
          ))}
        </>}

        {data.nextStep && (
          <div style={{ background:"#161b27", borderLeft:`4px solid ${accent}`, borderRadius:"10px", padding:"13px 16px", color:"#c0c8e0", fontSize:"14px", marginTop:"4px", lineHeight:"1.65" }}>
            <strong style={{ color:accent }}>Next Step: </strong>{data.nextStep}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [screen,   setScreen]   = useState("loading");
  const [profile,  setProfile]  = useState(null);   // { name, lang, apiKey }
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [sessions, setSessions] = useState([]);
  const [usage,    setUsage]    = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const [formType,  setFormType]  = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [sessId,    setSessId]    = useState(null);
  const [inputText, setInputText] = useState("");
  const [busy,      setBusy]      = useState(false);
  const [attached,  setAttached]  = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [summBusy,  setSummBusy]  = useState(false);

  const bottomRef = useRef(null);
  const textRef   = useRef(null);
  const attachRef = useRef(null);

  useEffect(() => { boot(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, busy]);

  async function boot() {
    try {
      const pv = await Store.get("fs:profile");
      const sv = await Store.get("fs:sessions");
      const uv = await Store.get("fs:usage");
      const prof = pv ? JSON.parse(pv) : null;
      const sess = sv ? JSON.parse(sv) : [];
      const use  = uv ? parseInt(uv)||0 : 0;
      if (prof) { setProfile(prof); setLanguage(LANGUAGES.find(l=>l.code===prof.lang)||LANGUAGES[0]); }
      setSessions(sess); setUsage(use);
      setScreen(prof ? "home" : "profile");
    } catch { setScreen("profile"); }
  }

  async function saveProfile(name, lang, apiKey) {
    const prof = { name, lang:lang.code, apiKey };
    setProfile(prof); setLanguage(lang);
    await Store.set("fs:profile", JSON.stringify(prof));
    setScreen("home");
  }

  async function updateSettings(name, apiKey) {
    const prof = { ...profile, name, apiKey };
    setProfile(prof);
    await Store.set("fs:profile", JSON.stringify(prof));
    setShowSettings(false);
  }

  async function persistSess(id, msgs, ft, lang) {
    try {
      await Store.set(`fs:session:${id}`, JSON.stringify({ messages:msgs, typeId:ft?.id, langCode:lang?.code, at:Date.now() }));
      const item = { id, type:ft?.label, icon:ft?.icon, lang:lang?.native, date:new Date().toLocaleDateString("en-IN"), msgs:msgs.filter(m=>!m.isImgMark).length };
      const list = [item, ...sessions.filter(s=>s.id!==id)].slice(0,8);
      setSessions(list);
      await Store.set("fs:sessions", JSON.stringify(list));
    } catch {}
  }

  async function bumpUsage() {
    const n=usage+1; setUsage(n);
    await Store.set("fs:usage", String(n));
  }

  // ── START NORMAL CHAT ──
  async function startChat(ft) {
    if (usage>=FREE_LIMIT) { alert("You have used all 3 free sessions!\n\nUpgrade to Pro for unlimited access. 🚀"); return; }
    const id=`sess_${Date.now()}`;
    setSessId(id); setFormType(ft); setMessages([]); setAttached(null); setSummary(null);
    setScreen("chat"); setBusy(true);
    await bumpUsage();

    try {
      const reply = await callGemini(
        [{ role:"user", content:`My name is ${profile?.name||"friend"}. I want to fill a "${ft.label}" form. Please greet me warmly in ${language.native} and ask which specific form I want to fill today. Give 2-3 popular examples from this category.` }],
        buildPrompt(language.native),
        profile?.apiKey
      );
      const msgs = [{ role:"assistant", content:reply }];
      setMessages(msgs); await persistSess(id, msgs, ft, language);
    } catch (err) {
      setMessages([{ role:"assistant", content:errMsg(err)+"\n\nTip: Go to ⚙️ Settings and check your Gemini API key.", isError:true }]);
    }
    setBusy(false); setTimeout(()=>textRef.current?.focus(), 200);
  }

  // ── IMAGE CHAT ──
  async function startImageChat(b64, mime) {
    if (usage>=FREE_LIMIT) { alert("Upgrade to Pro to use Image Upload! 🚀"); return; }
    const ft = { id:"image", label:"Form Image Upload", icon:"📸", accent:"#00bcd4" };
    const id = `sess_img_${Date.now()}`;
    setSessId(id); setFormType(ft); setAttached(null); setSummary(null);
    setScreen("chat"); setBusy(true);
    await bumpUsage();

    const imgMark = { role:"user", content:"[Form image uploaded]", isImgMark:true, imgSrc:`data:${mime};base64,${b64}` };

    try {
      const msgContent = [
        { type:"image", source:{ media_type:mime, data:b64 } },
        { type:"text",  text:`My name is ${profile?.name||"friend"}. I uploaded a form image. Please: 1) Tell me what form this is, 2) List all the fields you can see, 3) Guide me field by field. Respond in ${language.native}.` }
      ];
      const reply = await callGemini([{ role:"user", content:msgContent }], buildPrompt(language.native), profile?.apiKey);
      const msgs = [imgMark, { role:"assistant", content:reply }];
      setMessages(msgs); await persistSess(id, msgs, ft, language);
    } catch (err) {
      setMessages([imgMark, { role:"assistant", content:`Hello ${profile?.name||"friend"}! 🙏 I received your form. Let me guide you through each field carefully. What is the form name shown at the top?` }]);
    }
    setBusy(false); setTimeout(()=>textRef.current?.focus(), 200);
  }

  function handleImgUpload(e) {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{ const b64=ev.target.result.split(",")[1]; startImageChat(b64, file.type||"image/jpeg"); };
    reader.readAsDataURL(file); e.target.value="";
  }

  async function resumeSession(sess) {
    try {
      const raw=await Store.get(`fs:session:${sess.id}`); if(!raw) return;
      const parsed=JSON.parse(raw);
      const ft  =FORM_TYPES.find(f=>f.id===parsed.typeId)||{ id:parsed.typeId, label:sess.type, icon:sess.icon, accent:"#4caf7d" };
      const lang=LANGUAGES.find(l=>l.code===parsed.langCode)||language;
      setMessages(parsed.messages||[]); setSessId(sess.id);
      setFormType(ft); setLanguage(lang); setSummary(null); setAttached(null);
      setScreen("chat");
    } catch {}
  }

  async function sendMessage() {
    if ((!inputText.trim()&&!attached)||busy) return;
    const text=inputText.trim(); setInputText("");

    let userDisplay, apiContent;
    if (attached) {
      userDisplay = { role:"user", content:text||"Please check this image", imgSrc:`data:${attached.mime};base64,${attached.b64}` };
      apiContent  = [{ type:"image", source:{ media_type:attached.mime, data:attached.b64 } }, { type:"text", text:text||"Check this image" }];
      setAttached(null);
    } else {
      userDisplay = { role:"user", content:text };
      apiContent  = text;
    }

    const newMsgs=[...messages, userDisplay];
    setMessages(newMsgs); setBusy(true);

    const apiMsgs=newMsgs.map((m,i)=>{
      if (m.isImgMark) return { role:"user", content:"[User uploaded a form image at the start of the conversation]" };
      if (i===newMsgs.length-1 && userDisplay.imgSrc) return { role:"user", content:apiContent };
      return { role:m.role, content:m.content };
    });

    try {
      const reply=await callGemini(apiMsgs, buildPrompt(language.native), profile?.apiKey);
      const updated=[...newMsgs, { role:"assistant", content:reply }];
      setMessages(updated); await persistSess(sessId, updated, formType, language);
    } catch (err) {
      setMessages([...newMsgs, { role:"assistant", content:errMsg(err)+"\n\nPlease try again. 🙏", isError:true }]);
    }
    setBusy(false); textRef.current?.focus();
  }

  async function generateSummary() {
    setSummBusy(true);
    try {
      const apiMsgs=messages.filter(m=>!m.isImgMark).map(m=>({ role:m.role, content:m.content }));
      apiMsgs.push({ role:"user", content:"GENERATE_SUMMARY" });
      const raw=await callGemini(apiMsgs, buildPrompt(language.native), profile?.apiKey);
      const match=raw.match(/\{[\s\S]*\}/);
      if (match) setSummary(JSON.parse(match[0]));
      else alert("Please continue the conversation a bit more, then try again.");
    } catch (err) { alert(errMsg(err)); }
    setSummBusy(false);
  }

  function handleKey(e) { if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }
  function handleAttach(e) {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setAttached({ b64:ev.target.result.split(",")[1], mime:file.type||"image/jpeg", name:file.name });
    reader.readAsDataURL(file); e.target.value="";
  }

  // ── SCREENS ──
  if (screen==="loading") return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0d1117", color:"#4a5a7a", fontFamily:"monospace" }}>Loading FormSathi...</div>;
  if (screen==="profile") return <ProfileScreen onSave={saveProfile} />;
  if (screen==="home")    return <>
    <HomeScreen profile={profile} sessions={sessions} usageCount={usage} language={language} onStart={startChat} onResume={resumeSession} onLangChange={l=>setLanguage(l)} onImgUpload={handleImgUpload} onOpenSettings={()=>setShowSettings(true)} />
    {showSettings && <SettingsModal profile={profile} onSave={updateSettings} onClose={()=>setShowSettings(false)} />}
  </>;

  const accent = formType?.accent||"#4caf7d";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0d1117", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-7px);opacity:1}}
        @keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        textarea:focus,input:focus{outline:none}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#2a3347;border-radius:3px}
        @media print{.np{display:none!important}}
      `}</style>

      {/* TOP BAR */}
      <div className="np" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 16px", background:"#0a0e18", borderBottom:`2px solid ${accent}33`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <button style={{ background:"#161b27", border:"1px solid #2a3555", color:"#7a8499", borderRadius:"8px", padding:"5px 10px", cursor:"pointer", fontSize:"12px" }} onClick={()=>setScreen("home")}>← Home</button>
          <span style={{ fontSize:"18px" }}>{formType?.icon}</span>
          <div>
            <div style={{ fontWeight:"bold", fontSize:"14px", color:accent }}>{formType?.label}</div>
            <div style={{ fontSize:"11px", color:"#4a5568", fontFamily:"monospace" }}>FormSathi · Gemini · {language.native}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {messages.filter(m=>!m.isImgMark).length>5 && (
            <button disabled={summBusy} onClick={generateSummary}
              style={{ background:`${accent}18`, color:accent, border:`1px solid ${accent}44`, borderRadius:"8px", padding:"6px 13px", fontSize:"12px", fontWeight:"bold", cursor:summBusy?"not-allowed":"pointer" }}>
              {summBusy?"⏳ Generating...":"📋 Get Summary"}
            </button>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:"5px", background:`${accent}18`, color:accent, borderRadius:"20px", padding:"4px 10px", fontSize:"11px", fontWeight:"bold" }}>
            <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:accent, boxShadow:`0 0 6px ${accent}` }} />Live
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", display:"flex", flexDirection:"column", gap:"14px" }}>
        {messages.map((msg,i) => {
          const isUser=msg.role==="user";
          return (
            <div key={i} style={{ display:"flex", alignItems:"flex-end", gap:"8px", justifyContent:isUser?"flex-end":"flex-start", animation:"pop 0.25s ease" }}>
              {!isUser && <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:`${accent}18`, color:accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>🤖</div>}
              <div style={{ maxWidth:"72%", padding:"11px 15px", fontSize:"14px", lineHeight:"1.68", wordBreak:"break-word", background:isUser?accent:"#1a2035", color:isUser?"#000":"#e0e4f0", borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px", boxShadow:isUser?`0 4px 18px ${accent}44`:"0 2px 10px #0006", border:msg.isError?"1px solid #ff6b6b44":"none" }}>
                {msg.imgSrc && <img src={msg.imgSrc} alt="form" style={{ maxWidth:"100%", maxHeight:"200px", borderRadius:"8px", marginBottom:"8px", display:"block", objectFit:"contain" }} />}
                {msg.content.split("\n").map((line,j) => (
                  <span key={j}>
                    {line.startsWith("⚠️")?<span style={{ color:isUser?"#8b0000":"#ff8a65", fontWeight:"bold" }}>{line}</span>
                     :line.startsWith("✅")?<span style={{ color:isUser?"#014421":"#69f0ae", fontWeight:"bold" }}>{line}</span>
                     :line}
                    {j<msg.content.split("\n").length-1 && <br />}
                  </span>
                ))}
                {msg.isError && (
                  <button style={{ marginTop:"10px", background:"#ff6b6b22", border:"1px solid #ff6b6b44", color:"#ff8a65", borderRadius:"6px", padding:"5px 12px", cursor:"pointer", fontSize:"12px", display:"block" }}
                    onClick={()=>{ setMessages(messages.slice(0,-1)); setBusy(false); }}>
                    🔄 Remove & Try Again
                  </button>
                )}
              </div>
              {isUser && <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"#1e2840", color:"#8899bb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>👤</div>}
            </div>
          );
        })}
        {busy && (
          <div style={{ display:"flex", alignItems:"flex-end", gap:"8px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:`${accent}18`, color:accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px" }}>🤖</div>
            <div style={{ padding:"11px 16px", background:"#1a2035", borderRadius:"18px 18px 18px 4px", display:"flex", alignItems:"center", gap:"10px", color:"#6a7a9a", fontSize:"13px" }}>
              <span style={{ display:"inline-flex", gap:"4px" }}>
                {[0,.2,.4].map((d,k)=><span key={k} style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#6a7a9a", display:"inline-block", animation:`bounce 1.2s ${d}s infinite` }} />)}
              </span>
              Thinking in {language.native}...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ATTACHED PREVIEW */}
      {attached && (
        <div className="np" style={{ margin:"0 16px 6px", padding:"8px 14px", background:"#1a2035", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"space-between", color:"#8899bb", fontSize:"13px" }}>
          <span>📎 {attached.name}</span>
          <button style={{ background:"none", border:"none", color:"#ff6b6b", cursor:"pointer", fontSize:"20px" }} onClick={()=>setAttached(null)}>×</button>
        </div>
      )}

      {/* INPUT */}
      <div className="np" style={{ padding:"10px 16px 14px", background:"#0a0e18", borderTop:"1px solid #1a2035", flexShrink:0 }}>
        <input ref={attachRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAttach} />
        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", background:"#161b27", borderRadius:"14px", padding:"8px 8px 8px 14px", border:`2px solid ${accent}55` }}>
          <button title="Attach image" style={{ background:"none", border:"none", fontSize:"18px", cursor:"pointer", opacity:.55, paddingBottom:"5px", color:accent }} onClick={()=>attachRef.current?.click()}>📎</button>
          <textarea ref={textRef} value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={handleKey}
            placeholder="Type in any language... (Enter to send)" rows={1} disabled={busy}
            style={{ flex:1, background:"transparent", border:"none", color:"#e0e4f0", fontSize:"14px", resize:"none", fontFamily:"inherit", lineHeight:"1.55", maxHeight:"110px", overflowY:"auto", paddingTop:"3px" }} />
          <button onClick={sendMessage} disabled={busy||(!inputText.trim()&&!attached)}
            style={{ width:"38px", height:"38px", borderRadius:"10px", border:"none", cursor:"pointer", background:(!busy&&(inputText.trim()||attached))?accent:"#1e2840", color:(!busy&&(inputText.trim()||attached))?"#000":"#3a4a6a", fontSize:"17px", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s", flexShrink:0 }}>➤</button>
        </div>
        <p style={{ textAlign:"center", color:"#2a3555", fontSize:"11px", margin:"6px 0 0", fontFamily:"monospace" }}>
          💡 Gemini AI · Responds in {language.native} · Validates every field · Enter to send
        </p>
      </div>

      {summary && <SummaryModal data={summary} accent={accent} onClose={()=>setSummary(null)} />}
      {showSettings && <SettingsModal profile={profile} onSave={updateSettings} onClose={()=>setShowSettings(false)} />}
    </div>
  );
}

// ─── Profile styles ─────────────────────────────────────────────────
const P = {
  page: { minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Georgia',serif", padding:"20px" },
  card: { background:"#0e1420", border:"1px solid #1e2840", borderRadius:"22px", padding:"40px 34px", maxWidth:"440px", width:"100%", textAlign:"center" },
  title:{ margin:"0 0 6px", fontSize:"30px", fontWeight:"bold", background:"linear-gradient(135deg,#4caf7d,#00bcd4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
  sub:  { margin:"0 0 32px", color:"#4a5a7a", fontSize:"13px", letterSpacing:"1px", fontFamily:"monospace" },
  lbl:  { display:"block", color:"#4a5a7a", fontSize:"11px", marginBottom:"8px", letterSpacing:"1.5px", fontFamily:"monospace", textTransform:"uppercase", textAlign:"left" },
  inp:  { width:"100%", background:"#161b27", border:"1px solid #2a3555", borderRadius:"10px", padding:"12px 14px", color:"#e0e4f0", fontSize:"15px", fontFamily:"inherit", boxSizing:"border-box", marginBottom:"4px" },
  lb:   { background:"#161b27", border:"1px solid #2a3555", color:"#6a7a9a", borderRadius:"8px", padding:"7px 12px", cursor:"pointer", fontSize:"13px", transition:"all 0.15s" },
  lba:  { background:"#4caf7d18", border:"1px solid #4caf7d", color:"#4caf7d" },
  go:   { width:"100%", background:"linear-gradient(135deg,#4caf7d,#00bcd4)", color:"#000", border:"none", borderRadius:"12px", padding:"14px", fontSize:"16px", fontWeight:"bold", cursor:"pointer", marginTop:"8px" },
};
