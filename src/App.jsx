import { useState, useEffect, useRef } from "react";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const SECTEURS = [
  "Hôtellerie & Tourisme","BTP & Construction","Commerce & Distribution",
  "Santé & Social","Transport & Logistique","Restauration",
  "Services aux entreprises","Agriculture & Pêche","Éducation & Formation",
  "Administration & Collectivités","Industrie & Manufacture","Finance & Assurance",
];
const ILES = [
  "Tahiti - Papeete","Tahiti - Faa'a","Tahiti - Punaauia","Tahiti - Pirae",
  "Tahiti - Arue","Tahiti - Mahina","Moorea","Bora Bora","Raiatea / Uturoa",
  "Huahine","Maupiti","Rangiroa","Tikehau","Fakarava","Hiva Oa","Nuku Hiva",
];
const BESOINS = [
  { id:"paie",        label:"Externalisation paie", icon:"💰" },
  { id:"recrutement", label:"Recrutement",           icon:"🎯" },
  { id:"formation",   label:"Formation",             icon:"📚" },
  { id:"audit_rh",    label:"Audit RH",              icon:"🔍" },
  { id:"conseil",     label:"Conseil juridique",     icon:"⚖️" },
  { id:"bilan",       label:"Bilan social",          icon:"📊" },
];
const TAILLES = [
  {val:"1-5",label:"1–5"},{val:"6-20",label:"6–20"},
  {val:"21-50",label:"21–50"},{val:"51-100",label:"51–100"},{val:"100+",label:"100+"},
];

// Thèmes de campagne AERH
const THEMES_CAMPAGNE = [
  {
    id:"audit_paie",
    label:"🔎 Audit paie gratuit",
    desc:"Offre d'audit paie offert — accroche sur erreurs fréquentes CPS/CST",
    service:"Moana Paye",
  },
  {
    id:"rentree_formation",
    label:"📚 Rentrée formation",
    desc:"Plan de formation H2 — financement FPG, N° SEFI 000769",
    service:"AERH Formations",
  },
  {
    id:"recrutement_express",
    label:"🎯 Recrutement express",
    desc:"Besoin urgent de candidats — délai 15 jours garanti",
    service:"AERH Recrutement",
  },
  {
    id:"diagnostic_rh",
    label:"⚖️ Diagnostic RH offert",
    desc:"Bilan RH gratuit 2h — conformité CTPF, contrats, registres",
    service:"AERH Consulting",
  },
  {
    id:"externalisation_paie",
    label:"💰 Offre Moana Paye",
    desc:"Présentation grille Confort/Sérénité — économies vs interne",
    service:"Moana Paye",
  },
  {
    id:"bilan_social",
    label:"📊 Bilan social 2025",
    desc:"Accompagnement bilan social obligatoire 2025",
    service:"AERH Consulting",
  },
];

// Statuts campagne
const STATUTS = {
  nouveau:   { label:"Nouveau",    color:"#475569", bg:"#1E2D3D" },
  contacte:  { label:"Contacté",   color:"#4A8A8A", bg:"#0F2820" },
  ouvert:    { label:"Ouvert",     color:"#6366F1", bg:"#1E1B4B" },
  repondu:   { label:"Répondu",    color:"#D97706", bg:"#1C1408" },
  rdv:       { label:"RDV fixé",   color:"#34D399", bg:"#052E16" },
  perdu:     { label:"Perdu",      color:"#E8441A", bg:"#1C0A08" },
};

// ─── SCORE ────────────────────────────────────────────────────────────────────
function calcScore(f) {
  let s = 0;
  if (f.besoins.length >= 3) s += 30;
  else if (f.besoins.length === 2) s += 20;
  else if (f.besoins.length === 1) s += 10;
  if (["51-100","100+"].includes(f.taille)) s += 25;
  else if (f.taille === "21-50") s += 15;
  else if (f.taille === "6-20") s += 8;
  if (f.urgence === "immédiat") s += 25;
  else if (f.urgence === "3mois") s += 15;
  else if (f.urgence === "6mois") s += 5;
  if (f.budget === "ouvert") s += 20;
  else if (f.budget === "defini") s += 10;
  return s;
}
function tempFromScore(s) {
  if (s >= 60) return "chaud";
  if (s >= 35) return "tiede";
  return "froid";
}
const TEMP = {
  chaud: { bg:"#E8441A", label:"🔥 CHAUD" },
  tiede: { bg:"#D97706", label:"🌤 TIÈDE" },
  froid: { bg:"#475569", label:"❄️ FROID" },
};

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
// Clé gérée via localStorage dans les fonctions

async function callClaude({ system, userMsg, useWebSearch = false, maxTokens = 1500 }) {
  const key = localStorage.getItem("aerh_anthropic_key") || "";
  if (!key) throw new Error("Clé Anthropic manquante — configurez-la dans ⚙️ Paramètres");
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role:"user", content:userMsg }],
  };
  if (useWebSearch) body.tools = [{ type:"web_search_20250305", name:"web_search" }];
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({...body, apiKey: key}),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error?.message || `Erreur API ${res.status}`);
  }
  const data = await res.json();
  return data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
}

// ─── RESEND API ───────────────────────────────────────────────────────────────
async function sendViaResend({ to, subject, html }) {
  const key = localStorage.getItem("aerh_resend_key") || "";
  if (!key) throw new Error("Clé Resend manquante — configurez-la dans ⚙️ Paramètres");
  const res = await fetch("/api/resend", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ to, subject, html, resendKey: key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || `Resend error ${res.status}`);
  }
  return await res.json();
}

// Convertit texte brut → HTML email simple
function textToHtml(text) {
  const lines = text.split("\n");
  // Première ligne = objet, on la retire du corps
  const corps = lines.filter(l => !l.startsWith("Objet :")).join("\n");
  const escaped = corps
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\n/g,"<br>");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#222;max-width:600px;margin:0 auto;padding:32px 24px;">
${escaped}
<hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
<p style="font-size:11px;color:#999;">
  Vous recevez cet email car votre entreprise est susceptible d'être intéressée par nos services RH.<br>
  <a href="mailto:contact@groupeaerhpolynesie.com?subject=Désinscription" style="color:#999;">Se désinscrire</a>
</p>
</body></html>`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  card:  { background:"#141C26", borderRadius:14, border:"1px solid #1E2D3D", overflow:"hidden" },
  head:  {
    padding:"12px 18px", borderBottom:"1px solid #1E2D3D",
    fontSize:11, fontWeight:700, color:"#4A8A8A",
    letterSpacing:"0.8px", textTransform:"uppercase",
    display:"flex", alignItems:"center", justifyContent:"space-between",
  },
  input: {
    width:"100%", background:"#0F1923", border:"1px solid #1E2D3D",
    borderRadius:8, color:"#E2E8F0", padding:"9px 12px",
    fontSize:13, outline:"none", boxSizing:"border-box",
    transition:"border-color .2s", fontFamily:"inherit",
  },
  label: { display:"block", fontSize:11, fontWeight:600, color:"#64748B", marginBottom:5, letterSpacing:"0.3px" },
  btn: (bg, color, disabled) => ({
    padding:"10px 20px", borderRadius:10, border:"none",
    cursor: disabled ? "not-allowed":"pointer",
    fontWeight:700, fontSize:13, color,
    background: disabled ? "#1E2D3D" : bg,
    opacity: disabled ? 0.45 : 1,
    transition:"all .2s", fontFamily:"inherit", whiteSpace:"nowrap",
  }),
};

// ─── PETITS COMPOSANTS ────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type="text", rows }) {
  const [f, setF] = useState(false);
  const style = { ...S.input, borderColor: f ? "#4A8A8A":"#1E2D3D" };
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={S.label}>{label}</label>}
      {rows
        ? <textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder} style={{ ...style, resize:"vertical", lineHeight:1.6 }}
            onFocus={()=>setF(true)} onBlur={()=>setF(false)} />
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder} style={style}
            onFocus={()=>setF(true)} onBlur={()=>setF(false)} />}
    </div>
  );
}
function Sel({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={S.label}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{ ...S.input, cursor:"pointer", color:value?"#E2E8F0":"#64748B" }}>
        <option value="">— Sélectionner —</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 11px", borderRadius:8, border:"none", cursor:"pointer",
      fontWeight:600, fontSize:12,
      background: active ? "#0F2820":"#1E2D3D",
      color:       active ? "#34D399":"#64748B",
      outline:     active ? "1px solid #4A8A8A":"1px solid transparent",
      transition:"all .2s", fontFamily:"inherit",
    }}>{children}</button>
  );
}
function ScoreBar({ score }) {
  const t = TEMP[tempFromScore(score)];
  return (
    <div style={{ ...S.card, padding:"13px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:14 }}>
      <span style={{ padding:"4px 12px", borderRadius:20, background:t.bg, color:"#fff", fontSize:11, fontWeight:700 }}>
        {t.label}
      </span>
      <span style={{ fontSize:18, fontWeight:800, color:t.bg }}>
        {score}<span style={{ fontSize:11, color:"#334155", fontWeight:400 }}>/100</span>
      </span>
      <div style={{ flex:1, height:5, background:"#1E2D3D", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:3, width:`${Math.min(score,100)}%`, background:t.bg, transition:"width .4s" }}/>
      </div>
    </div>
  );
}

// ─── SYSTÈME PROMPTS ──────────────────────────────────────────────────────────
const SYS_RECHERCHE = `Tu es un assistant de prospection pour AERH Polynésie, cabinet RH à Papeete.
Recherche sur le web des entreprises en Polynésie française susceptibles d'avoir besoin des services AERH :
- Moana Paye (externalisation paie), AERH Recrutement, AERH Formations (N°SEFI 000769), AERH Consulting (audit RH, CTPF)

Signaux d'achat : offre d'emploi publiée, ouverture/expansion, appel d'offres, absence RH interne visible.

Pour chaque prospect, structure EXACTEMENT ainsi :
---
🏢 ENTREPRISE : [nom]
📍 LOCALISATION : [île]
🏭 SECTEUR : [secteur]
👥 EFFECTIF : [estimation ou "non trouvé"]
👤 CONTACT : [nom dirigeant ou "non trouvé"]
📧 EMAIL : [email ou "non trouvé"]
🎯 BESOINS AERH : [services pertinents]
⚡ SIGNAL : [raison du besoin]
---
Maximum 5 prospects. Sois factuel.`;

const SYS_EMAIL = `Tu es un expert commercial senior du cabinet AERH Polynésie.
Règles absolues :
- Première ligne OBLIGATOIREMENT : "Objet : [objet percutant]"
- Corps : 120 à 150 mots
- Ton professionnel et chaleureux, ancré fenua polynésien
- Mentionner 1-2 services AERH pertinents selon les besoins ET le thème de campagne
- Action concrète : appel, audit gratuit, diagnostic RH
- JAMAIS "prud'hommes" → "Tribunal du travail de Papeete" ou "Inspection du travail"
- Formation : jamais de TVA (HT=TTC), N° SEFI 000769
- Moana Paye : Confort 3 500 F HT/mois, Sérénité 6 500 F HT/mois
- Signature : Eric ASPINAS | SARL GROUPE AERH POLYNÉSIE | 87 73 78 15 | contact@groupeaerhpolynesie.com`;

// ─── BLOC RECHERCHE ───────────────────────────────────────────────────────────
function RechercheBlock({ onPrefill }) {
  const [q, setQ]           = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState("");
  const [error, setError]     = useState("");
  const [dots, setDots]       = useState("");

  useEffect(() => {
    if (!loading) { setDots(""); return; }
    const t = setInterval(()=>setDots(d=>d.length>=3?"":d+"."), 500);
    return ()=>clearInterval(t);
  }, [loading]);

  async function search() {
    if (!q.trim()) return;
    setLoading(true); setResult(""); setError("");
    try {
      const out = await callClaude({
        system: SYS_RECHERCHE,
        userMsg: `Recherche des prospects pour AERH Polynésie : ${q}\nUtilise la recherche web pour trouver des entreprises réelles et actuelles en Polynésie française.`,
        useWebSearch: false,
      });
      setResult(out);
    } catch(e) { setError("Erreur : "+e.message); }
    setLoading(false);
  }

  function parseBlocs(text) {
    return text.split("---").map(s=>s.trim()).filter(s=>s.length>20);
  }

  return (
    <div style={{ ...S.card, marginBottom:18 }}>
      <div style={S.head}>
        <span>🔍 Recherche prospects — Claude web</span>
        <span style={{ fontSize:10, color:"#334155", fontWeight:400, textTransform:"none", letterSpacing:0 }}>
          natif · inclus dans ton abonnement
        </span>
      </div>
      <div style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", gap:8, marginBottom: result||error ? 12:0 }}>
          <input value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") search(); }}
            placeholder='ex. "Hôtels Bora Bora 30 salariés" · "BTP Tahiti en croissance" · "Restaurants Moorea"'
            style={{ ...S.input, flex:1 }} />
          <button onClick={search} disabled={loading||!q.trim()}
            style={S.btn("linear-gradient(135deg,#4A8A8A,#1D3D3D)","#fff",loading||!q.trim())}>
            {loading ? `Recherche${dots}` : "🔍 Chercher"}
          </button>
        </div>
        {error && (
          <div style={{ background:"#1A0808", border:"1px solid #7F1D1D", borderRadius:8,
            padding:"10px 14px", color:"#FCA5A5", fontSize:12 }}>{error}</div>
        )}
        {result && !loading && (
          <div>
            <div style={{ fontSize:10, color:"#4A8A8A", fontWeight:700, marginBottom:8, letterSpacing:"0.5px" }}>
              CLIQUEZ SUR UN PROSPECT POUR PRÉ-REMPLIR LE FORMULAIRE
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {parseBlocs(result).map((bloc,i)=>(
                <div key={i} onClick={()=>onPrefill(bloc)}
                  style={{
                    background:"#0F1923", borderRadius:10, border:"1px solid #1E2D3D",
                    padding:"12px 14px", cursor:"pointer",
                    fontSize:12, color:"#94A3B8", lineHeight:1.7, whiteSpace:"pre-wrap",
                    transition:"all .2s",
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#4A8A8A"; e.currentTarget.style.background="#0F2820"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="#1E2D3D"; e.currentTarget.style.background="#0F1923"; }}>
                  {bloc}
                  <div style={{ marginTop:6, fontSize:10, color:"#4A8A8A", fontWeight:700 }}>
                    → Cliquer pour utiliser ce prospect
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PARSER PROSPECT ──────────────────────────────────────────────────────────
function parseProspect(text) {
  const get = (...keys) => {
    for (const line of text.split("\n")) {
      if (keys.some(k=>line.toLowerCase().includes(k.toLowerCase()))) {
        const val = line.split(":").slice(1).join(":").trim().replace(/^\[|\]$/g,"");
        if (val && val!=="non trouvé") return val;
      }
    }
    return "";
  };
  const lower = text.toLowerCase();
  const besoins = [];
  if (lower.includes("paie")||lower.includes("bulletin")) besoins.push("paie");
  if (lower.includes("recrut")||lower.includes("embauche")||lower.includes("offre d'emploi")) besoins.push("recrutement");
  if (lower.includes("formation")||lower.includes("compétence")) besoins.push("formation");
  if (lower.includes("audit")||lower.includes("conform")) besoins.push("audit_rh");
  if (lower.includes("juridique")||lower.includes("contrat")||lower.includes("droit")) besoins.push("conseil");
  return {
    entreprise: get("ENTREPRISE","entreprise"),
    secteur:    get("SECTEUR","secteur"),
    ile:        get("LOCALISATION","localisation","île"),
    taille:     get("EFFECTIF","effectif"),
    contact:    get("CONTACT","dirigeant","gérant"),
    email:      get("EMAIL","email","mail","📧"),
    poste:"", telephone:"", urgence:"", budget:"",
    besoins,
    notes: text.slice(0,500),
  };
}

// ─── MODULE CAMPAGNE ─────────────────────────────────────────────────────────
function ModuleCampagne({ leads, onLeadsUpdate }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [theme, setTheme]             = useState("");
  const [step, setStep]               = useState("config"); // config | preview | sending | done
  const [previews, setPreviews]       = useState([]);       // [{lead, subject, body, status}]
  const [genIdx, setGenIdx]           = useState(0);
  const [editIdx, setEditIdx]         = useState(null);
  const [sendLog, setSendLog]         = useState([]);
  const [dots, setDots]               = useState("");

  const modeSimu = false; // Clé Resend gérée côté serveur via variable d'environnement Netlify

  useEffect(() => {
    if (step !== "sending") { setDots(""); return; }
    const t = setInterval(()=>setDots(d=>d.length>=3?"":d+"."), 600);
    return ()=>clearInterval(t);
  }, [step]);

  function toggleId(id) {
    setSelectedIds(p=>p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  }

  const eligibles = leads.filter(l=>l.form.email && l.form.email.includes("@"));
  const sansEmail = leads.filter(l=>!l.form.email || !l.form.email.includes("@"));
  const selectedLeads = eligibles.filter(l=>selectedIds.includes(l.id));

  async function genererPreviews() {
    if (!theme || selectedLeads.length === 0) return;
    setStep("preview");
    setPreviews([]);
    setGenIdx(0);
    const themeMeta = THEMES_CAMPAGNE.find(t=>t.id===theme);

    for (let i=0; i<selectedLeads.length; i++) {
      setGenIdx(i+1);
      const l = selectedLeads[i];
      try {
        const msg = await callClaude({
          system: SYS_EMAIL,
          userMsg: `Génère un email de prospection AERH personnalisé.

THÈME DE CAMPAGNE : ${themeMeta.label} — ${themeMeta.desc}
SERVICE MIS EN AVANT : ${themeMeta.service}

PROSPECT :
- Entreprise : ${l.form.entreprise || "non précisé"}
- Contact : ${l.form.contact || "non précisé"}${l.form.poste ? ` (${l.form.poste})` : ""}
- Secteur : ${l.form.secteur || "non précisé"}
- Île : ${l.form.ile || "non précisé"}
- Effectif : ${l.form.taille || "non précisé"} salariés
- Besoins : ${l.form.besoins.join(", ") || "non précisés"}
- Score : ${l.score}/100 (${l.temp})
- Contexte : ${l.form.notes?.slice(0,200) || "aucun"}

Adapte le message précisément au secteur "${l.form.secteur}" et mets en avant "${themeMeta.service}".`,
          maxTokens: 600,
        });

        // Extraire objet et corps
        const lines = msg.split("\n");
        const objetLine = lines.find(ln=>ln.startsWith("Objet :"));
        const subject = objetLine ? objetLine.replace("Objet :","").trim() : `AERH Polynésie — ${themeMeta.label}`;
        const body = lines.filter(ln=>!ln.startsWith("Objet :")).join("\n").trim();

        setPreviews(p=>[...p,{ lead:l, subject, body, status:"prêt", error:null }]);
      } catch(e) {
        setPreviews(p=>[...p,{ lead:l, subject:"", body:"", status:"erreur", error:e.message }]);
      }
    }
  }

  async function lancerCampagne() {
    if (modeSimu) {
      // Mode simulation : marquer tout comme "envoyé simulé"
      setSendLog([]);
      setStep("sending");
      for (let i=0; i<previews.length; i++) {
        await new Promise(r=>setTimeout(r,600));
        const p = previews[i];
        setSendLog(l=>[...l,{
          email: p.lead.form.email,
          entreprise: p.lead.form.entreprise,
          status:"simulé",
          msg:"✅ Simulation — email prêt (Resend non configuré)",
        }]);
        setPreviews(prev=>prev.map((x,j)=>j===i?{...x,status:"simulé"}:x));
      }
      // Mettre à jour statuts leads
      const updated = leads.map(l=>{
        const pv = previews.find(p=>p.lead.id===l.id);
        return pv ? { ...l, statut:"contacte", dateCampagne:new Date().toLocaleDateString("fr-FR") } : l;
      });
      onLeadsUpdate(updated);
      setStep("done");
      return;
    }

    // Envoi réel via Resend
    setStep("sending");
    setSendLog([]);
    for (let i=0; i<previews.length; i++) {
      const p = previews[i];
      if (p.status === "erreur") continue;
      try {
        await sendViaResend({
          to: p.lead.form.email,
          subject: p.subject,
          html: textToHtml(p.body),
        });
        setSendLog(l=>[...l,{ email:p.lead.form.email, entreprise:p.lead.form.entreprise, status:"envoyé", msg:"✅ Envoyé" }]);
        setPreviews(prev=>prev.map((x,j)=>j===i?{...x,status:"envoyé"}:x));
      } catch(e) {
        setSendLog(l=>[...l,{ email:p.lead.form.email, entreprise:p.lead.form.entreprise, status:"erreur", msg:"❌ "+e.message }]);
        setPreviews(prev=>prev.map((x,j)=>j===i?{...x,status:"erreur envoi"}:x));
      }
      await new Promise(r=>setTimeout(r,1200)); // pause entre envois
    }
    const updated = leads.map(l=>{
      const pv = previews.find(p=>p.lead.id===l.id && p.status==="envoyé");
      return pv ? { ...l, statut:"contacte", dateCampagne:new Date().toLocaleDateString("fr-FR") } : l;
    });
    onLeadsUpdate(updated);
    setStep("done");
  }

  function reset() {
    setStep("config"); setSelectedIds([]); setTheme("");
    setPreviews([]); setSendLog([]); setEditIdx(null);
  }

  // ── ÉTAPE CONFIG ──
  if (step === "config") return (
    <div>
      {modeSimu && (
        <div style={{
          background:"#1C1408", border:"1px solid #D9770633",
          borderRadius:10, padding:"12px 16px", marginBottom:16,
          fontSize:12, color:"#D97706",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <div>
            <strong>Mode simulation</strong> — Resend non configuré. Les emails seront générés et prévisualisés
            mais pas envoyés. Ajoutez votre clé Resend dans les paramètres pour activer l'envoi réel.
          </div>
        </div>
      )}

      {/* Thème campagne */}
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={S.head}><span>🎨 Thème de la campagne</span></div>
        <div style={{ padding:"14px 16px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {THEMES_CAMPAGNE.map(t=>(
              <button key={t.id} onClick={()=>setTheme(theme===t.id?"":t.id)} style={{
                padding:"12px 14px", borderRadius:10, border:"none", cursor:"pointer",
                textAlign:"left", fontFamily:"inherit",
                background: theme===t.id ? "#0F2820":"#1E2D3D",
                outline: theme===t.id ? "1px solid #4A8A8A":"1px solid transparent",
                transition:"all .2s",
              }}>
                <div style={{ fontWeight:700, fontSize:13, color:theme===t.id?"#34D399":"#E2E8F0", marginBottom:4 }}>
                  {t.label}
                </div>
                <div style={{ fontSize:11, color:"#64748B", lineHeight:1.4 }}>{t.desc}</div>
                <div style={{ fontSize:10, color:"#4A8A8A", marginTop:4, fontWeight:600 }}>
                  → {t.service}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sélection prospects */}
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={S.head}>
          <span>📋 Sélection des prospects ({selectedIds.length} sélectionné{selectedIds.length>1?"s":""})</span>
          <button onClick={()=>setSelectedIds(selectedIds.length===eligibles.length?[]:eligibles.map(l=>l.id))}
            style={{ ...S.btn("transparent","#4A8A8A",false), padding:"4px 12px", fontSize:11,
              outline:"1px solid #4A8A8A", borderRadius:6 }}>
            {selectedIds.length===eligibles.length ? "Tout désélectionner":"Tout sélectionner"}
          </button>
        </div>
        <div style={{ padding:"14px 16px" }}>
          {eligibles.length === 0 ? (
            <div style={{ color:"#475569", fontSize:13, textAlign:"center", padding:"20px 0" }}>
              Aucun prospect avec email dans le pipeline.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {eligibles.map(l=>{
                const m = TEMP[l.temp];
                const sel = selectedIds.includes(l.id);
                return (
                  <div key={l.id} onClick={()=>toggleId(l.id)} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"10px 14px", borderRadius:10, cursor:"pointer",
                    background: sel ? "#0F2820":"#0F1923",
                    border: sel ? "1px solid #4A8A8A":"1px solid #1E2D3D",
                    transition:"all .2s",
                  }}>
                    <div style={{
                      width:18, height:18, borderRadius:4,
                      background: sel ? "#4A8A8A":"#1E2D3D",
                      border: sel ? "none":"1px solid #334155",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, color:"#fff", flexShrink:0,
                    }}>{sel ? "✓":""}</div>
                    <span style={{ padding:"2px 8px", borderRadius:12, background:m.bg, color:"#fff", fontSize:9, fontWeight:700 }}>
                      {m.label}
                    </span>
                    <span style={{ fontWeight:600, fontSize:13 }}>{l.form.entreprise||"Sans nom"}</span>
                    <span style={{ fontSize:12, color:"#64748B" }}>{l.form.contact}</span>
                    <span style={{ fontSize:11, color:"#4A8A8A", marginLeft:"auto" }}>{l.form.email}</span>
                    {l.statut === "contacte" && (
                      <span style={{ fontSize:10, color:"#D97706", fontWeight:600 }}>déjà contacté</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {sansEmail.length > 0 && (
            <div style={{ marginTop:12, padding:"10px 14px", background:"#1C1408",
              borderRadius:8, border:"1px solid #D9770633", fontSize:11, color:"#D97706" }}>
              ⚠️ {sansEmail.length} prospect{sansEmail.length>1?"s":""} sans email :
              {" "}{sansEmail.map(l=>l.form.entreprise||"Sans nom").join(", ")}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign:"center" }}>
        <button
          onClick={genererPreviews}
          disabled={!theme || selectedLeads.length===0}
          style={{
            ...S.btn("linear-gradient(135deg,#4A8A8A,#1D3D3D)","#fff",!theme||selectedLeads.length===0),
            padding:"14px 48px", fontSize:14,
            boxShadow: theme&&selectedLeads.length>0 ? "0 8px 32px rgba(74,138,138,0.3)":"none",
          }}>
          ✨ Générer {selectedLeads.length} email{selectedLeads.length>1?"s":""} personnalisé{selectedLeads.length>1?"s":""}
        </button>
        {(!theme || selectedLeads.length===0) && (
          <div style={{ color:"#334155", fontSize:11, marginTop:6 }}>
            Choisissez un thème et sélectionnez au moins 1 prospect
          </div>
        )}
      </div>
    </div>
  );

  // ── ÉTAPE PRÉVISUALISATION ──
  if (step === "preview") {
    const done = previews.length;
    const total = selectedLeads.length;
    const enCours = done < total;
    return (
      <div>
        {enCours && (
          <div style={{
            ...S.card, padding:"16px 20px", marginBottom:16,
            display:"flex", alignItems:"center", gap:16,
          }}>
            <div style={{ flex:1, height:6, background:"#1E2D3D", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#4A8A8A", borderRadius:3,
                width:`${(done/total)*100}%`, transition:"width .4s" }}/>
            </div>
            <span style={{ fontSize:12, color:"#4A8A8A", fontWeight:600, whiteSpace:"nowrap" }}>
              Génération {done}/{total}…
            </span>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:20 }}>
          {previews.map((p,i)=>(
            <div key={i} style={S.card}>
              <div style={{ ...S.head }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ padding:"2px 8px", borderRadius:12, fontSize:9, fontWeight:700,
                    background:TEMP[p.lead.temp].bg, color:"#fff" }}>
                    {TEMP[p.lead.temp].label}
                  </span>
                  <span style={{ fontWeight:700, color:"#E2E8F0" }}>
                    {p.lead.form.entreprise||"Sans nom"} — {p.lead.form.email}
                  </span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {p.status==="prêt" && (
                    <button onClick={()=>setEditIdx(editIdx===i?null:i)}
                      style={{ ...S.btn("transparent","#4A8A8A",false), padding:"4px 10px", fontSize:10,
                        outline:"1px solid #4A8A8A", borderRadius:6 }}>
                      {editIdx===i ? "Fermer":"✏️ Modifier"}
                    </button>
                  )}
                  <span style={{ padding:"4px 10px", borderRadius:12, fontSize:10, fontWeight:700,
                    background: p.status==="erreur"?"#7F1D1D":p.status==="prêt"?"#0F2820":"#1E2D3D",
                    color: p.status==="erreur"?"#FCA5A5":p.status==="prêt"?"#34D399":"#64748B",
                  }}>
                    {p.status==="prêt"?"✅ Prêt":p.status==="erreur"?"❌ Erreur":"⏳"}
                  </span>
                </div>
              </div>

              {p.status==="erreur" ? (
                <div style={{ padding:"12px 16px", color:"#FCA5A5", fontSize:12 }}>{p.error}</div>
              ) : editIdx===i ? (
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ marginBottom:10 }}>
                    <label style={S.label}>Objet</label>
                    <input value={p.subject}
                      onChange={e=>setPreviews(prev=>prev.map((x,j)=>j===i?{...x,subject:e.target.value}:x))}
                      style={{ ...S.input }} />
                  </div>
                  <div>
                    <label style={S.label}>Corps de l'email</label>
                    <textarea rows={10} value={p.body}
                      onChange={e=>setPreviews(prev=>prev.map((x,j)=>j===i?{...x,body:e.target.value}:x))}
                      style={{ ...S.input, resize:"vertical", lineHeight:1.7 }} />
                  </div>
                </div>
              ) : (
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:11, color:"#64748B", marginBottom:6 }}>
                    Objet : <span style={{ color:"#E2E8F0", fontWeight:600 }}>{p.subject}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#94A3B8", lineHeight:1.7,
                    whiteSpace:"pre-wrap", fontFamily:"Georgia,serif",
                    maxHeight:120, overflow:"hidden",
                    WebkitMaskImage:"linear-gradient(180deg,#000 60%,transparent)",
                  }}>
                    {p.body}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!enCours && (
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={reset}
              style={{ ...S.btn("transparent","#64748B",false), outline:"1px solid #334155" }}>
              ← Recommencer
            </button>
            <button onClick={lancerCampagne}
              disabled={previews.filter(p=>p.status==="prêt").length===0}
              style={{
                ...S.btn(
                  modeSimu
                    ? "linear-gradient(135deg,#6366F1,#4338CA)"
                    : "linear-gradient(135deg,#4A8A8A,#1D3D3D)",
                  "#fff",
                  previews.filter(p=>p.status==="prêt").length===0
                ),
                padding:"14px 40px", fontSize:14,
                boxShadow:"0 8px 32px rgba(74,138,138,0.3)",
              }}>
              {modeSimu
                ? `🧪 Simuler l'envoi (${previews.filter(p=>p.status==="prêt").length} emails)`
                : `🚀 Envoyer la campagne (${previews.filter(p=>p.status==="prêt").length} emails)`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── ÉTAPE ENVOI ──
  if (step === "sending") return (
    <div style={{ textAlign:"center", padding:"40px 0" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>
        {modeSimu ? "🧪" : "📤"}
      </div>
      <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>
        {modeSimu ? `Simulation en cours${dots}` : `Envoi en cours${dots}`}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6, maxWidth:480, margin:"24px auto 0" }}>
        {sendLog.map((l,i)=>(
          <div key={i} style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"8px 14px", background:"#141C26", borderRadius:8,
            fontSize:12,
          }}>
            <span style={{ color:"#94A3B8" }}>{l.entreprise} — {l.email}</span>
            <span style={{ color: l.status==="erreur"?"#FCA5A5":"#34D399", fontWeight:600 }}>
              {l.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ÉTAPE DONE ──
  if (step === "done") {
    const ok  = sendLog.filter(l=>l.status!=="erreur").length;
    const ko  = sendLog.filter(l=>l.status==="erreur").length;
    return (
      <div style={{ textAlign:"center", padding:"32px 0" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>{modeSimu?"🧪":"🎉"}</div>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:6 }}>
          {modeSimu ? "Simulation terminée" : "Campagne envoyée !"}
        </div>
        <div style={{ color:"#64748B", fontSize:13, marginBottom:24 }}>
          {ok} email{ok>1?"s":""} {modeSimu?"simulé":"envoyé"}{ok>1?"s":""}
          {ko>0 && <span style={{ color:"#E8441A" }}> · {ko} erreur{ko>1?"s":""}</span>}
        </div>
        {modeSimu && (
          <div style={{
            background:"#1C1408", border:"1px solid #D9770633",
            borderRadius:10, padding:"14px 20px", marginBottom:20,
            fontSize:12, color:"#D97706", maxWidth:480, margin:"0 auto 24px",
          }}>
            Pour envoyer réellement ces emails, configurez votre clé Resend dans les paramètres.
            Vos emails seront envoyés depuis <strong>contact@groupeaerhpolynesie.com</strong>.
          </div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={reset} style={S.btn("linear-gradient(135deg,#4A8A8A,#1D3D3D)","#fff",false)}>
            Nouvelle campagne
          </button>
        </div>
      </div>
    );
  }
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
const FORM_VIDE = {
  entreprise:"", contact:"", poste:"", email:"", telephone:"",
  secteur:"", ile:"", taille:"", besoins:[], urgence:"", budget:"", notes:"",
};

export default function App() {
  const [tab, setTab]         = useState("form");   // form | pipeline | campagne | settings
  const [step, setStep]       = useState("form");   // form | result
  const [form, setForm]       = useState(FORM_VIDE);
  const [result, setResult]   = useState(null);
  const [genLoading, setGen]  = useState(false);
  const [copied, setCopied]   = useState(false);
  const [leads, setLeads]     = useState([]);
  const [resendKey, setResendKey]           = useState("");
  const [resendKeySaved, setResendKeySaved] = useState(false);
  const [anthropicKey, setAnthropicKey]     = useState("");
  const [anthropicSaved, setAnthropicSaved] = useState(false);

  useEffect(() => {
    const l = localStorage.getItem("aerh_leads_v4");
    if (l) setLeads(JSON.parse(l));
    const rk = localStorage.getItem("aerh_resend_key");
    if (rk) { setResendKey(rk); setResendKeySaved(true); }
    const ak = localStorage.getItem("aerh_anthropic_key");
    if (ak) { setAnthropicKey(ak); setAnthropicSaved(true); }

    // Lecture des paramètres URL depuis l'artifact Prospect Finder
    const params = new URLSearchParams(window.location.search);
    if (params.get("entreprise") || params.get("contact") || params.get("email")) {
      const besoins = params.get("besoins")
        ? params.get("besoins").split(",").filter(Boolean)
        : [];
      setForm({
        entreprise:  params.get("entreprise")  || "",
        contact:     params.get("contact")     || "",
        poste:       params.get("poste")       || "",
        email:       params.get("email")       || "",
        telephone:   params.get("telephone")   || "",
        secteur:     params.get("secteur")     || "",
        ile:         params.get("ile")         || "",
        taille:      params.get("taille")      || "",
        urgence:     "",
        budget:      "",
        besoins,
        notes:       params.get("notes")       || "",
      });
      setTab("form");
      setStep("form");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function saveLeads(updated) {
    setLeads(updated);
    localStorage.setItem("aerh_leads_v4", JSON.stringify(updated));
  }
  function saveResendKey() {
    localStorage.setItem("aerh_resend_key", resendKey);
    setResendKeySaved(true);
  }
  function clearResendKey() {
    localStorage.removeItem("aerh_resend_key");
    setResendKey(""); setResendKeySaved(false);
  }
  function saveAnthropicKey() {
    localStorage.setItem("aerh_anthropic_key", anthropicKey);
    setAnthropicSaved(true);
  }
  function clearAnthropicKey() {
    localStorage.removeItem("aerh_anthropic_key");
    setAnthropicKey(""); setAnthropicSaved(false);
  }
  function clearKey() {
    localStorage.removeItem("aerh_resend_key");
    setResendKey(""); setResendKeySaved(false);
  }

  function toggleBesoin(id) {
    setForm(f=>({
      ...f,
      besoins: f.besoins.includes(id) ? f.besoins.filter(b=>b!==id) : [...f.besoins,id],
    }));
  }

  function prefillFromRecherche(bloc) {
    const parsed = parseProspect(bloc);
    setForm(f=>({ ...f, ...parsed }));
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function generer() {
    setGen(true);
    const score = calcScore(form);
    const temp  = tempFromScore(score);
    try {
      const msg = await callClaude({
        system: SYS_EMAIL,
        userMsg: `Génère un email de prospection AERH.
Entreprise : ${form.entreprise||"non précisé"}
Contact : ${form.contact||"non précisé"}${form.poste?` (${form.poste})`:""}
Secteur : ${form.secteur||"non précisé"}
Île : ${form.ile||"non précisé"}
Effectif : ${form.taille||"non précisé"} salariés
Besoins : ${form.besoins.join(", ")||"non précisés"}
Urgence : ${form.urgence||"—"} | Budget : ${form.budget||"—"}
Contexte : ${form.notes||"aucun"}
Score : ${score}/100 (${temp})`,
        maxTokens: 600,
      });
      const lead = {
        id:Date.now(), date:new Date().toLocaleDateString("fr-FR"),
        score, temp, form:{...form}, message:msg, statut:"nouveau",
      };
      saveLeads([lead,...leads]);
      setResult(lead); setStep("result");
    } catch(e) { alert("Erreur : "+e.message); }
    setGen(false);
  }

  function reset() { setForm(FORM_VIDE); setResult(null); setStep("form"); }
  function delLead(id) { saveLeads(leads.filter(l=>l.id!==id)); }
  function updateStatut(id, statut) { saveLeads(leads.map(l=>l.id===id?{...l,statut}:l)); }

  const score  = calcScore(form);
  const canGen = form.contact.trim() && form.besoins.length>0;
  const TABS   = [
    { key:"form",      label:"➕ Nouveau lead" },
    { key:"pipeline",  label:`📋 Pipeline (${leads.length})` },
    { key:"campagne",  label:"📨 Campagne" },
    { key:"settings",  label:"⚙️" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D1520",
      fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#E2E8F0" }}>

      {/* HEADER */}
      <div style={{ background:"#0F1923", borderBottom:"1px solid #1E2D3D" }}>
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"0 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8,
                background:"linear-gradient(135deg,#4A8A8A,#1D3D3D)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🎯</div>
              <div>
                <div style={{ fontWeight:800, fontSize:13, letterSpacing:"-0.3px" }}>
                  Lead Generator
                  <span style={{ marginLeft:8, fontSize:10, color:"#4A8A8A", fontWeight:500 }}>v4</span>
                </div>
                <div style={{ fontSize:9, color:"#334155" }}>AERH POLYNÉSIE</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)} style={{
                  padding:"6px 14px", borderRadius:8, border:"none",
                  cursor:"pointer", fontWeight:600, fontSize:12,
                  background: tab===t.key?"#4A8A8A":"transparent",
                  color: tab===t.key?"#fff":"#64748B",
                  transition:"all .2s",
                }}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1040, margin:"0 auto", padding:"24px 24px" }}>

        {/* ══ SETTINGS ══ */}
        {tab==="settings" && (
          <div style={{ maxWidth:560, margin:"0 auto", display:"flex", flexDirection:"column", gap:16 }}>

            {/* Clé Anthropic */}
            <div style={S.card}>
              <div style={S.head}><span>🤖 Clé API Anthropic (Claude)</span></div>
              <div style={{ padding:"16px 20px" }}>
                <p style={{ fontSize:12, color:"#64748B", margin:"0 0 10px" }}>
                  Obtenez votre clé sur{" "}
                  <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
                    style={{ color:"#4A8A8A" }}>console.anthropic.com</a>
                  {" "}→ API Keys → Create Key.
                </p>
                {anthropicSaved ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ padding:"9px 14px", background:"#0F2820",
                      border:"1px solid #4A8A8A", borderRadius:8,
                      fontSize:13, color:"#34D399", flex:1 }}>
                      ✅ Clé Anthropic configurée
                    </div>
                    <button onClick={clearAnthropicKey}
                      style={{ ...S.btn("#1E2D3D","#E8441A",false), padding:"9px 14px" }}>
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="password" value={anthropicKey}
                      onChange={e=>setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-xxxxxxxxxxxx"
                      style={{ ...S.input, flex:1 }} />
                    <button onClick={saveAnthropicKey} disabled={!anthropicKey}
                      style={S.btn("#4A8A8A","#fff",!anthropicKey)}>
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Clé Resend */}
            <div style={S.card}>
              <div style={S.head}><span>📧 Clé API Resend</span></div>
              <div style={{ padding:"16px 20px" }}>
                <p style={{ fontSize:12, color:"#64748B", margin:"0 0 10px" }}>
                  Obtenez votre clé sur{" "}
                  <a href="https://resend.com" target="_blank" rel="noreferrer"
                    style={{ color:"#4A8A8A" }}>resend.com</a>
                  {" "}· Domaine{" "}
                  <code style={{ color:"#4A8A8A" }}>groupeaerhpolynesie.com</code>
                  {" "}déjà vérifié ✅
                </p>
                {resendKeySaved ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ padding:"9px 14px", background:"#0F2820",
                      border:"1px solid #4A8A8A", borderRadius:8,
                      fontSize:13, color:"#34D399", flex:1 }}>
                      ✅ Clé Resend configurée
                    </div>
                    <button onClick={clearResendKey}
                      style={{ ...S.btn("#1E2D3D","#E8441A",false), padding:"9px 14px" }}>
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="password" value={resendKey}
                      onChange={e=>setResendKey(e.target.value)}
                      placeholder="re_xxxxxxxxxxxx"
                      style={{ ...S.input, flex:1 }} />
                    <button onClick={saveResendKey} disabled={!resendKey}
                      style={S.btn("#4A8A8A","#fff",!resendKey)}>
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(!anthropicSaved || !resendKeySaved) && (
              <div style={{ background:"#1C1408", border:"1px solid #D9770633",
                borderRadius:10, padding:"12px 16px", fontSize:12, color:"#D97706" }}>
                ⚠️ Configurez les deux clés pour activer toutes les fonctionnalités.
              </div>
            )}
            {anthropicSaved && resendKeySaved && (
              <div style={{ background:"#052E16", border:"1px solid #34D39933",
                borderRadius:10, padding:"12px 16px", fontSize:12, color:"#34D399" }}>
                ✅ Tout est configuré — recherche Claude et envoi Resend opérationnels.
              </div>
            )}
          </div>
        )}

        {/* ══ CAMPAGNE ══ */}
        {tab==="campagne" && (
          <ModuleCampagne
            leads={leads}
            onLeadsUpdate={saveLeads}
          />
        )}

        {/* ══ PIPELINE ══ */}
        {tab==="pipeline" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
              {[
                { l:"Total",      v:leads.length,                                  c:"#4A8A8A" },
                { l:"🔥 Chauds", v:leads.filter(l=>l.temp==="chaud").length,      c:"#E8441A" },
                { l:"📨 Contactés",v:leads.filter(l=>l.statut==="contacte").length,c:"#6366F1" },
                { l:"✅ RDV",     v:leads.filter(l=>l.statut==="rdv").length,      c:"#34D399" },
              ].map(s=>(
                <div key={s.l} style={{ ...S.card, padding:"14px 16px" }}>
                  <div style={{ fontSize:24, fontWeight:800, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:11, color:"#64748B", marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {leads.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"#334155" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                <div>Aucun lead. Créez-en un !</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {leads.map(l=>{
                  const m = TEMP[l.temp];
                  const st = STATUTS[l.statut||"nouveau"];
                  return (
                    <div key={l.id} style={S.card}>
                      <div style={{ padding:"12px 16px", display:"flex",
                        alignItems:"center", gap:10, flexWrap:"wrap",
                        borderBottom:"1px solid #1E2D3D" }}>
                        <span style={{ padding:"2px 8px", borderRadius:12,
                          background:m.bg, color:"#fff", fontSize:9, fontWeight:700 }}>
                          {m.label}
                        </span>
                        <span style={{ fontWeight:700, fontSize:13 }}>
                          {l.form.entreprise||"Sans nom"}
                        </span>
                        <span style={{ color:"#64748B", fontSize:12 }}>
                          {l.form.contact}{l.form.secteur?` · ${l.form.secteur}`:""}
                        </span>
                        <span style={{ fontSize:11, color:"#4A8A8A" }}>{l.form.email}</span>
                        <span style={{ marginLeft:"auto", color:m.bg, fontWeight:700, fontSize:12 }}>
                          {l.score}/100
                        </span>
                        {/* Statut select */}
                        <select value={l.statut||"nouveau"}
                          onChange={e=>updateStatut(l.id,e.target.value)}
                          style={{
                            background:st.bg, color:st.color,
                            border:`1px solid ${st.color}44`,
                            borderRadius:8, padding:"3px 8px",
                            fontSize:11, fontWeight:700, cursor:"pointer",
                            outline:"none",
                          }}>
                          {Object.entries(STATUTS).map(([k,v])=>(
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <button onClick={()=>delLead(l.id)} style={{
                          background:"transparent", border:"none",
                          color:"#334155", cursor:"pointer", fontSize:13,
                        }}>🗑</button>
                      </div>
                      <div style={{ padding:"10px 16px", fontSize:11,
                        color:"#475569", lineHeight:1.6, fontStyle:"italic" }}>
                        {l.message?.slice(0,180)}…
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ FORM ══ */}
        {tab==="form" && step==="form" && (
          <div>
            <ScoreBar score={score} />
            <RechercheBlock onPrefill={prefillFromRecherche} />

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={S.card}>
                  <div style={S.head}><span>👤 Identité</span></div>
                  <div style={{ padding:"14px 16px" }}>
                    <Field label="Entreprise" value={form.entreprise}
                      onChange={v=>setForm({...form,entreprise:v})} placeholder="Nom de la société" />
                    <Field label="Contact *" value={form.contact}
                      onChange={v=>setForm({...form,contact:v})} placeholder="Prénom Nom" />
                    <Field label="Poste" value={form.poste}
                      onChange={v=>setForm({...form,poste:v})} placeholder="DRH, Gérant, DAF…" />
                    <Field label="Email" value={form.email}
                      onChange={v=>setForm({...form,email:v})} placeholder="contact@entreprise.pf" type="email" />
                    <Field label="Téléphone" value={form.telephone}
                      onChange={v=>setForm({...form,telephone:v})} placeholder="87 XX XX XX" />
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.head}><span>📍 Localisation</span></div>
                  <div style={{ padding:"14px 16px" }}>
                    <Sel label="Île / Zone" value={form.ile} options={ILES}
                      onChange={v=>setForm({...form,ile:v})} />
                    <Sel label="Secteur" value={form.secteur} options={SECTEURS}
                      onChange={v=>setForm({...form,secteur:v})} />
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.head}><span>📝 Notes</span></div>
                  <div style={{ padding:"14px 16px" }}>
                    <Field value={form.notes} onChange={v=>setForm({...form,notes:v})} rows={4}
                      placeholder="Contexte, signal d'achat, source…" />
                  </div>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={S.card}>
                  <div style={S.head}><span>📊 Qualification</span></div>
                  <div style={{ padding:"14px 16px" }}>
                    <div style={{ marginBottom:14 }}>
                      <label style={S.label}>Effectif</label>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                        {TAILLES.map(t=>(
                          <Chip key={t.val} active={form.taille===t.val}
                            onClick={()=>setForm({...form,taille:form.taille===t.val?"":t.val})}>
                            {t.label} sal.
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={S.label}>Urgence</label>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                        {[{v:"immédiat",l:"🔥 Immédiat"},{v:"3mois",l:"⏰ 3 mois"},
                          {v:"6mois",l:"📅 6 mois"},{v:"exploration",l:"🔭 Exploration"}].map(u=>(
                          <Chip key={u.v} active={form.urgence===u.v}
                            onClick={()=>setForm({...form,urgence:form.urgence===u.v?"":u.v})}>
                            {u.l}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Budget</label>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                        {[{v:"ouvert",l:"💚 Ouvert"},{v:"defini",l:"📋 Défini"},
                          {v:"contraint",l:"🔴 Contraint"},{v:"inconnu",l:"❓ Inconnu"}].map(b=>(
                          <Chip key={b.v} active={form.budget===b.v}
                            onClick={()=>setForm({...form,budget:form.budget===b.v?"":b.v})}>
                            {b.l}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.head}><span>🎯 Besoins *</span></div>
                  <div style={{ padding:"14px 16px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {BESOINS.map(b=>(
                        <button key={b.id} onClick={()=>toggleBesoin(b.id)} style={{
                          padding:"10px 12px", borderRadius:8, border:"none",
                          cursor:"pointer", fontWeight:600, fontSize:12,
                          textAlign:"left", fontFamily:"inherit",
                          background: form.besoins.includes(b.id)?"#0F2820":"#1E2D3D",
                          color: form.besoins.includes(b.id)?"#34D399":"#64748B",
                          outline: form.besoins.includes(b.id)?"1px solid #4A8A8A":"1px solid transparent",
                          transition:"all .2s",
                        }}>{b.icon} {b.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop:22, textAlign:"center" }}>
              <button onClick={generer} disabled={genLoading||!canGen}
                style={{
                  ...S.btn("linear-gradient(135deg,#4A8A8A,#1D3D3D)","#fff",genLoading||!canGen),
                  padding:"13px 48px", fontSize:14,
                  boxShadow:canGen&&!genLoading?"0 8px 32px rgba(74,138,138,0.3)":"none",
                }}>
                {genLoading?"⏳ Génération…":"✨ Générer le lead & l'email"}
              </button>
              {!canGen && <div style={{ color:"#334155", fontSize:11, marginTop:6 }}>
                Contact + 1 besoin minimum
              </div>}
            </div>
          </div>
        )}

        {/* ══ RÉSULTAT ══ */}
        {tab==="form" && step==="result" && result && (()=>{
          const m = TEMP[result.temp];
          return (
            <div>
              <div style={{ ...S.card, marginBottom:16,
                background:`linear-gradient(135deg,${m.bg}0D,#141C26)`,
                borderColor:`${m.bg}44` }}>
                <div style={{ padding:"20px 22px", display:"flex", alignItems:"center", gap:20 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"inline-block", padding:"4px 12px",
                      borderRadius:20, background:m.bg, color:"#fff",
                      fontSize:11, fontWeight:800, marginBottom:8 }}>{m.label}</div>
                    <div style={{ fontWeight:800, fontSize:18 }}>
                      {result.form.entreprise||"Prospect"} — {result.form.contact}
                    </div>
                    <div style={{ color:"#64748B", fontSize:12, marginTop:3 }}>
                      {[result.form.secteur,result.form.ile,result.form.taille?result.form.taille+" sal.":null]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:44, fontWeight:900, color:m.bg, lineHeight:1 }}>{result.score}</div>
                    <div style={{ fontSize:10, color:"#334155" }}>/ 100</div>
                  </div>
                </div>
              </div>

              <div style={{ ...S.card, marginBottom:16 }}>
                <div style={S.head}>
                  <span>✉️ Email généré</span>
                  <button onClick={()=>{ navigator.clipboard.writeText(result.message);
                    setCopied(true); setTimeout(()=>setCopied(false),2000); }}
                    style={{ ...S.btn("#4A8A8A","#fff",false), padding:"5px 14px", fontSize:11 }}>
                    {copied?"✅ Copié !":"📋 Copier"}
                  </button>
                </div>
                <div style={{ padding:"20px 22px", fontSize:13.5, lineHeight:1.9,
                  color:"#CBD5E1", whiteSpace:"pre-wrap",
                  fontFamily:"'Georgia','Times New Roman',serif" }}>
                  {result.message}
                </div>
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={reset} style={S.btn("linear-gradient(135deg,#4A8A8A,#1D3D3D)","#fff",false)}>
                  ➕ Nouveau lead
                </button>
                <button onClick={()=>setTab("pipeline")}
                  style={{ ...S.btn("transparent","#4A8A8A",false), outline:"1px solid #4A8A8A" }}>
                  📋 Pipeline ({leads.length})
                </button>
                <button onClick={()=>setTab("campagne")}
                  style={{ ...S.btn("transparent","#6366F1",false), outline:"1px solid #6366F1" }}>
                  📨 Lancer une campagne
                </button>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
