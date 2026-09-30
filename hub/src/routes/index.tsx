import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Clock3, Database, Eye, FileCheck2, FileText,
  Filter, History, LayoutGrid, LifeBuoy, LockKeyhole, MessageSquareText,
  Languages, LogOut, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Send,
  Settings, ShieldCheck, Sparkles, Trash2, UserRound, UserRoundCheck,
  XCircle,
  Mail, Users, Globe, FolderOpen, Link2, Unlink,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { CertaintyBadge, TrustPanel, type Certainty } from "@/components/TrustPanel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { COUNTRIES, CUSTOMER_TYPES, EMPLOYEE, PRODUCTS } from "@/lib/hub-options";
import { answerKnowledgeQuestion } from "@/lib/knowledge-answer.functions";
import {
  completeM365Connection, disconnectM365Connection, getM365Status, searchM365Knowledge,
  startM365Connect,
} from "@/lib/m365.functions";
import { M365_CONNECTORS, type M365ConnectorId } from "@/lib/m365-options";
import { signOutEmployee, useEmployeeSession } from "@/lib/useEmployeeSession";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Knowledge Hub — SD Worx" },
    { name: "description", content: "Review evidence-backed answers across authorised SD Worx knowledge." },
    { property: "og:title", content: "Knowledge Hub — SD Worx" },
    { property: "og:description", content: "Review evidence-backed answers across authorised SD Worx knowledge." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: KnowledgeHub,
});

type View = "workspace" | "recent" | "library" | "privacy" | "m365";
type DialogKind = "context" | "issue" | "escalate" | "capture" | null;
type HubLanguage = "English" | "Nederlands" | "Français" | "Deutsch";

const hubCopy = {
  English: { secure: "Secure session", newQuestion: "New question", workspace: "Dashboard", recent: "Recent questions", library: "Knowledge library", scope: "Authorised scope", greeting: "Hi", title: "Ask with confidence", verified: "Access verified", customerQuestion: "Customer question", country: "Country", searchCountry: "Search country…", customerType: "Customer type", product: "Product", privacy: "Questions are processed for this answer only and are not saved. Do not include personal data.", analyse: "Analyse question", generating: "Generating answer…", draft: "AI-generated draft · Employee review required", proposed: "Proposed answer", check: "Check before sending", use: "Use answer", edit: "Edit draft", save: "Save changes", evidence: "View evidence", evidenceUsed: "Evidence used", viewAll: "View all", confidence: "Confidence", needsAttention: "Needs attention", reviewExcluded: "Review excluded evidence", certainty: "Need more certainty?", requestContext: "Request context", escalate: "Escalate", certaintyLabels: { verified: "Verified", likely: "Likely", conflicting: "Conflicting", no_answer: "No answer" }, work: "Work", ask: "Ask", review: "Review", m365: "Microsoft 365", m365Title: "Microsoft 365 knowledge", m365Intro: "Connect the Microsoft 365 places where SD Worx knowledge already lives. The hub searches only the areas your knowledge admin approved, using your own Microsoft access.", connect: "Connect", connected: "Connected", notConnected: "Not connected", approvedAreas: "Approved knowledge areas", areasNote: "Only these areas are searched. Everything else stays private.", noAreas: "No areas are approved yet. Ask a knowledge admin to add the channels, mailboxes and sites the hub may search.", noAreasConnector: "None approved yet", searchAreas: "Search approved areas", searchAreasNote: "Findings come live from your Microsoft connection. Nothing is copied into the hub.", searching: "Searching…", noFindings: "Nothing was found in the approved areas for this wording. Try another phrase.", areasUnavailable: "Some approved areas could not be read", setupNeeded: "Waiting for the Microsoft app approval", setupDetail: "A workspace admin must approve the SD Worx Microsoft app before employees can connect their accounts.", m365Policy: "Your connection only reads approved areas, and only while you are signed in. Nothing from Microsoft 365 is stored in the hub, and results are visible to you alone." },
  Nederlands: { secure: "Beveiligde sessie", newQuestion: "Nieuwe vraag", workspace: "Dashboard", recent: "Recente vragen", library: "Kennisbibliotheek", scope: "Bevoegd bereik", greeting: "Hoi", title: "Vraag met vertrouwen", verified: "Toegang geverifieerd", customerQuestion: "Klantvraag", country: "Land", searchCountry: "Land zoeken…", customerType: "Klanttype", product: "Product", privacy: "Vragen worden alleen voor dit antwoord verwerkt en niet opgeslagen. Voeg geen persoonsgegevens toe.", analyse: "Vraag analyseren", generating: "Antwoord genereren…", draft: "AI-concept · Controle door medewerker vereist", proposed: "Voorgesteld antwoord", check: "Controleer voor verzending", use: "Antwoord gebruiken", edit: "Concept bewerken", save: "Wijzigingen opslaan", evidence: "Bronnen bekijken", evidenceUsed: "Gebruikte bronnen", viewAll: "Alles bekijken", confidence: "Betrouwbaarheid", needsAttention: "Aandacht vereist", reviewExcluded: "Uitgesloten bronnen bekijken", certainty: "Meer zekerheid nodig?", requestContext: "Context opvragen", escalate: "Escaleren", certaintyLabels: { verified: "Geverifieerd", likely: "Waarschijnlijk", conflicting: "Tegenstrijdig", no_answer: "Geen antwoord" }, work: "Werk", ask: "Vraag", review: "Controle", m365: "Microsoft 365", m365Title: "Microsoft 365-kennis", m365Intro: "Verbind de plekken in Microsoft 365 waar SD Worx-kennis al staat. De hub doorzoekt alleen de gebieden die uw kennisbeheerder heeft goedgekeurd, met uw eigen Microsoft-toegang.", connect: "Verbinden", connected: "Verbonden", notConnected: "Niet verbonden", approvedAreas: "Goedgekeurde kennisgebieden", areasNote: "Alleen deze gebieden worden doorzocht. Alles andere blijft privé.", noAreas: "Nog geen gebieden goedgekeurd. Vraag een kennisbeheerder om de kanalen, mailboxen en sites toe te voegen.", noAreasConnector: "Nog geen", searchAreas: "Goedgekeurde gebieden doorzoeken", searchAreasNote: "Resultaten komen rechtstreeks uit uw Microsoft-verbinding. Er wordt niets overgezet naar de hub.", searching: "Bezig met zoeken…", noFindings: "Niets gevonden in de goedgekeurde gebieden voor deze formulering. Probeer een andere omschrijving.", areasUnavailable: "Sommige goedgekeurde gebieden konden niet worden gelezen", setupNeeded: "Wacht op goedkeuring van de Microsoft-app", setupDetail: "Een workspacebeheerder moet de SD Worx Microsoft-app goedkeuren voordat medewerkers hun account kunnen verbinden.", m365Policy: "Uw verbinding leest alleen goedgekeurde gebieden, en alleen tijdens uw sessie. Er wordt niets uit Microsoft 365 opgeslagen in de hub en resultaten zijn alleen voor u zichtbaar." },
  Français: { secure: "Session sécurisée", newQuestion: "Nouvelle question", workspace: "Tableau de bord", recent: "Questions récentes", library: "Bibliothèque", scope: "Périmètre autorisé", greeting: "Bonjour", title: "Posez votre question en confiance", verified: "Accès vérifié", customerQuestion: "Question du client", country: "Pays", searchCountry: "Rechercher un pays…", customerType: "Type de client", product: "Produit", privacy: "La question est traitée uniquement pour cette réponse et n’est pas enregistrée. N’ajoutez aucune donnée personnelle.", analyse: "Analyser la question", generating: "Génération de la réponse…", draft: "Brouillon généré par l’IA · Révision requise", proposed: "Réponse proposée", check: "À vérifier avant l’envoi", use: "Utiliser la réponse", edit: "Modifier le brouillon", save: "Enregistrer", evidence: "Voir les sources", evidenceUsed: "Sources utilisées", viewAll: "Tout voir", confidence: "Confiance", needsAttention: "À vérifier", reviewExcluded: "Voir les sources exclues", certainty: "Besoin de plus de certitude ?", requestContext: "Demander du contexte", escalate: "Transmettre", certaintyLabels: { verified: "Vérifié", likely: "Probable", conflicting: "Conflit", no_answer: "Pas de réponse" }, work: "Travail", ask: "Question", review: "Révision", m365: "Microsoft 365", m365Title: "Connaissances Microsoft 365", m365Intro: "Connectez les emplacements Microsoft 365 où la connaissance SD Worx existe déjà. Le hub ne recherche que les zones approuvées par votre administrateur de connaissances, avec votre propre accès Microsoft.", connect: "Connecter", connected: "Connecté", notConnected: "Non connecté", approvedAreas: "Zones de connaissances approuvées", areasNote: "Seules ces zones sont recherchées. Tout le reste reste privé.", noAreas: "Aucune zone approuvée pour le moment. Demandez à un administrateur de connaissances d'ajouter les canaux, boîtes et sites.", noAreasConnector: "Aucune pour le moment", searchAreas: "Rechercher dans les zones approuvées", searchAreasNote: "Les résultats proviennent directement de votre connexion Microsoft. Rien n'est copié dans le hub.", searching: "Recherche en cours…", noFindings: "Rien n'a été trouvé dans les zones approuvées pour cette formulation. Essayez une autre formulation.", areasUnavailable: "Certaines zones approuvées n'ont pas pu être lues", setupNeeded: "En attente de l'approbation de l'application Microsoft", setupDetail: "Un administrateur de l'espace de travail doit approuver l'application Microsoft de SD Worx avant que les collaborateurs puissent connecter leur compte.", m365Policy: "Votre connexion lit uniquement les zones approuvées, et seulement pendant votre session. Rien de Microsoft 365 n'est enregistré dans le hub et les résultats ne sont visibles que par vous." },
  Deutsch: { secure: "Sichere Sitzung", newQuestion: "Neue Frage", workspace: "Dashboard", recent: "Letzte Fragen", library: "Wissensbibliothek", scope: "Berechtigter Bereich", greeting: "Hallo", title: "Sicher fragen", verified: "Zugriff geprüft", customerQuestion: "Kundenfrage", country: "Land", searchCountry: "Land suchen…", customerType: "Kundentyp", product: "Produkt", privacy: "Fragen werden nur für diese Antwort verarbeitet und nicht gespeichert. Keine personenbezogenen Daten eingeben.", analyse: "Frage analysieren", generating: "Antwort wird erstellt…", draft: "KI-Entwurf · Prüfung durch Mitarbeitende erforderlich", proposed: "Vorgeschlagene Antwort", check: "Vor dem Senden prüfen", use: "Antwort verwenden", edit: "Entwurf bearbeiten", save: "Änderungen speichern", evidence: "Quellen ansehen", evidenceUsed: "Verwendete Quellen", viewAll: "Alle ansehen", confidence: "Vertrauen", needsAttention: "Zu beachten", reviewExcluded: "Ausgeschlossene Quellen prüfen", certainty: "Mehr Sicherheit nötig?", requestContext: "Kontext anfordern", escalate: "Eskalieren", certaintyLabels: { verified: "Verifiziert", likely: "Wahrscheinlich", conflicting: "Widersprüchlich", no_answer: "Keine Antwort" }, work: "Arbeit", ask: "Frage", review: "Prüfung", m365: "Microsoft 365", m365Title: "Microsoft-365-Wissen", m365Intro: "Verbinden Sie die Stellen in Microsoft 365, an denen SD Worx-Wissen bereits vorhanden ist. Der Hub durchsucht nur die Bereiche, die Ihr Wissensadministrator freigegeben hat – mit Ihrem eigenen Microsoft-Zugriff.", connect: "Verbinden", connected: "Verbunden", notConnected: "Nicht verbunden", approvedAreas: "Freigegebene Wissensbereiche", areasNote: "Nur diese Bereiche werden durchsucht. Alles andere bleibt privat.", noAreas: "Noch keine Bereiche freigegeben. Bitten Sie einen Wissensadministrator, Kanäle, Postfächer und Websites hinzuzufügen.", noAreasConnector: "Noch keine", searchAreas: "Freigegebene Bereiche durchsuchen", searchAreasNote: "Ergebnisse stammen direkt aus Ihrer Microsoft-Verbindung. Es wird nichts in den Hub übernommen.", searching: "Wird durchsucht…", noFindings: "In den freigegebenen Bereichen wurde nichts gefunden. Versuchen Sie eine andere Formulierung.", areasUnavailable: "Einige freigegebene Bereiche konnten nicht gelesen werden", setupNeeded: "Warten auf die Genehmigung der Microsoft-App", setupDetail: "Ein Workspace-Administrator muss die SD Worx Microsoft-App genehmigen, bevor Mitarbeitende ihr Konto verbinden können.", m365Policy: "Ihre Verbindung liest nur freigegebene Bereiche und nur während Ihrer Sitzung. Aus Microsoft 365 wird nichts im Hub gespeichert, und die Ergebnisse sind nur für Sie sichtbar." },
} as const;

const sourceItems = [
  { icon: FileCheck2, title: "Late payroll correction procedure", meta: "Procedure · Version 2.1 · Updated 14 Sep 2026", tag: "Approved", tone: "success", excerpt: "Corrections remain possible after payroll closing through the formal late-correction process." },
  { icon: BookOpen, title: "Payroll closing — Belgium", meta: "Product documentation · Payroll BE", tag: "Current", tone: "info", excerpt: "Describes the correction request, validation steps and impact on the next payroll run." },
  { icon: ClipboardCheck, title: "SME correction after closing", meta: "Expert-validated answer · Case #84219", tag: "Validated", tone: "success", excerpt: "A Belgian SME may request a correction when the payroll run is already closed." },
];
const excludedItems = [
  { title: "Payroll closing FAQ 2022", detail: "Superseded by procedure v2.1", tag: "Superseded", reason: "Outdated — cannot support the answer" },
  { title: "SME exceptions discussion", detail: "Teams · No expert validation", tag: "Unvalidated", reason: "Context only — expert validation required" },
];
const recentQuestions = [
  { id: "Q-2026-01482", question: "Can payroll data be corrected after closing?", context: "Belgium · SME · Payroll", status: "Answer ready", time: "12 min ago" },
  { id: "Q-2026-01479", question: "When is the holiday pay recalculation applied?", context: "Belgium · Enterprise · Payroll", status: "Validated", time: "Yesterday" },
  { id: "Q-2026-01461", question: "Can an absence request be changed after approval?", context: "Belgium · SME · HR", status: "Needs context", time: "28 Sep" },
  { id: "Q-2026-01438", question: "Which export includes cost-centre allocation?", context: "Belgium · Enterprise · Payroll", status: "Escalated", time: "25 Sep" },
];
const libraryItems = [
  ...sourceItems,
  { icon: FileText, title: "Exceptional payroll run policy", meta: "Policy · Version 4.0 · Reviewed 02 Sep 2026", tag: "Approved", tone: "success", excerpt: "Conditions and approvals for exceptional payroll runs in Belgium." },
  { icon: BookOpen, title: "Belgian payroll calendar 2026", meta: "Official article · Updated 18 Aug 2026", tag: "Current", tone: "info", excerpt: "Processing dates, cut-offs and statutory deadlines for the current year." },
];
const escalationPath = [
  { level: "Step 1", name: "Maya De Vos", initials: "MD", role: "Payroll knowledge owner · Belgium", can: "Confirms the rule and the wording", speed: "usually replies within 1 hour" },
  { level: "Step 2", name: "Lars Peeters", initials: "LP", role: "Team lead · Payroll services", can: "Decides whether the answer can be sent today", speed: "same working day" },
  { level: "Step 3", name: "Sofia Rinaldi", initials: "SR", role: "Department manager · Payroll", can: "Approves exceptions and customer commitments", speed: "within 2 working days" },
];
const escalationTarget = (step: (typeof escalationPath)[number]) => `${step.name}, ${step.role}`;
const defaultEscalationTarget = escalationPath.map(escalationTarget)[0] ?? "the Payroll knowledge owner";



function KnowledgeHub() {
  const { user, loading } = useEmployeeSession();
  if (loading) return <SplashScreen label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <HubApp user={user} />;
}

function HubApp({ user }: { user: User }) {
  const [view, setView] = useState<View>("workspace");
  const [question, setQuestion] = useState("Can payroll data be corrected after closing?");
  const [answerVisible, setAnswerVisible] = useState(true);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState("A correction can be requested after payroll closing through the applicable late-correction process. For a Belgian SME, submit the correction request with the adjusted payroll data. The change will be validated and processed according to the current payroll correction procedure.");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [escalateTo, setEscalateTo] = useState(defaultEscalationTarget);

  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [language, setLanguage] = useState<HubLanguage>("English");
  const [country, setCountry] = useState("Belgium");
  const [customerType, setCustomerType] = useState("SME");
  const [product, setProduct] = useState("Payroll");
  const [reviewWarning, setReviewWarning] = useState("Confirm the correction falls within the applicable period and does not require an exceptional run.");
  const [citedSourceIds, setCitedSourceIds] = useState(["S1", "S2", "S3"]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [certainty, setCertainty] = useState<Certainty>("verified");
  const [trustNotes, setTrustNotes] = useState<string[]>([]);
  const requestAnswer = useServerFn(answerKnowledgeQuestion);
  const copy = hubCopy[language];

  const profile = useMemo(() => {
    const email = user.email ?? "";
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = typeof meta["full_name"] === "string" && meta["full_name"]
      ? (meta["full_name"] as string)
      : typeof meta["name"] === "string" && meta["name"] ? (meta["name"] as string) : "";
    const name = metaName || email.split("@")[0] || EMPLOYEE.fullName;
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || EMPLOYEE.initials;
    return { name, firstName: parts[0] ?? name, email, initials };
  }, [user]);

  const personalDataWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (/\b\d{2}[.\-/ ]?\d{2}[.\-/ ]?\d{2}[-. ]?\d{3}[-. ]?\d{2}\b/.test(question)) warnings.push("Possible national register number");
    if (/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(question)) warnings.push("Email address");
    if (/\b(?:\+32|0)\s?\d(?:[ .-]?\d{2}){3,4}\b/.test(question)) warnings.push("Phone number");
    return warnings;
  }, [question]);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 3200); };
  const analyse = async () => {
    if (!question.trim() || personalDataWarnings.length) return;
    setChecking(true); setAnswerVisible(false); setAnalysisError(null);
    try {
      const result = await requestAnswer({ data: {
        question, language: language as "English" | "Nederlands" | "Français" | "Deutsch",
        country: country as (typeof COUNTRIES)[number],
        customerType: customerType as (typeof CUSTOMER_TYPES)[number],
        product: product as (typeof PRODUCTS)[number],
      } });
      if (!result.data) {
        setAnalysisError(result.error ?? "The answer service could not complete this request.");
        return;
      }
      setAnswer(result.data.answer);
      setReviewWarning(result.data.reviewWarning);
      setCitedSourceIds(result.data.citedSourceIds);
      setCertainty(result.data.certainty); setTrustNotes(result.data.reasons); setAnswerVisible(true);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The answer service could not complete this request.");
    } finally {
      setChecking(false);
    }
  };
  const navRef = useRef<HTMLElement>(null);
  const chooseView = (next: View) => { setView(next); setSearch(""); };
  const startQuestion = () => { setView("workspace"); setQuestion(""); setAnswerVisible(false); };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const box = active.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    if (box.left < navBox.left || box.right > navBox.right) {
      nav.scrollBy({ left: box.left - navBox.left - (navBox.width - box.width) / 2, behavior: "smooth" });
    }
  }, [view]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-shell/80 bg-shell text-shell-foreground">
          <div className="flex h-full w-full items-center px-4 sm:px-6">
            <div className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => chooseView("workspace")} aria-label="SD Worx Knowledge Hub — open the dashboard" title="Open the dashboard" className="flex items-end gap-2 rounded-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"><span className="flex h-7 items-end gap-[3px] pb-0.5" aria-hidden="true"><span className="h-4 w-[3px] -skew-x-[18deg] rounded-full bg-brand-blue" /><span className="h-6 w-[3px] -skew-x-[18deg] rounded-full bg-brand-red" /><span className="h-7 w-[3px] -skew-x-[18deg] rounded-full bg-brand-yellow" /></span><span className="font-display text-[22px] font-semibold leading-none tracking-tight">sd worx</span></button><div className="hidden border-l border-shell-foreground/15 pl-3 text-sm font-medium text-shell-foreground/70 sm:block">Knowledge Hub</div></div>
            <div className="relative ml-2 flex min-w-0 flex-1 sm:ml-4">
              <nav ref={navRef} className="flex min-w-0 flex-1 snap-x items-center gap-1 overflow-x-auto overscroll-x-contain scroll-smooth px-1 sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Main navigation">
                <Button size="sm" className="h-9 shrink-0 gap-2 whitespace-nowrap px-1.5 shadow-none sm:px-2.5" onClick={startQuestion} aria-label={copy.newQuestion}><Plus /> <span className="hidden sm:inline">{copy.newQuestion}</span></Button>
                <span className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
                <NavItem icon={LayoutGrid} label={copy.workspace} active={view === "workspace"} onClick={() => chooseView("workspace")} />
                <NavItem icon={History} label={copy.recent} active={view === "recent"} onClick={() => chooseView("recent")} />
                <NavItem icon={BookOpen} label={copy.library} active={view === "library"} onClick={() => chooseView("library")} />
              </nav>
              <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-shell to-transparent sm:hidden" aria-hidden="true" />
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" className="hidden text-shell-foreground hover:bg-shell-foreground/10 hover:text-shell-foreground md:flex" onClick={() => setPrivacyOpen(true)}><ShieldCheck className="text-success" /> {copy.secure}</Button>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label="Help" className="hidden text-shell-foreground hover:bg-shell-foreground/10 hover:text-shell-foreground md:inline-flex"><LifeBuoy /></Button></TooltipTrigger><TooltipContent>Help centre</TooltipContent></Tooltip>
              <div className="hidden h-7 w-px bg-shell-foreground/15 sm:block" />
              <div className="relative">
                <Button variant="ghost" aria-label={`Open ${profile.firstName}'s profile`} aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className="h-11 gap-2 px-1 text-shell-foreground hover:bg-shell-foreground/10 hover:text-shell-foreground"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{profile.initials}</span><span className="hidden text-left text-xs sm:block"><strong className="block font-semibold">{profile.name}</strong><span className="text-shell-foreground/60">{EMPLOYEE.role}</span></span><ChevronDown className={`hidden size-4 transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`} /></Button>
                {profileOpen && <div role="menu" aria-label={`${profile.name}'s profile`} className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                  <div className="flex gap-3 px-4 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{profile.initials}</span>
                    <span className="min-w-0"><strong className="block text-sm font-semibold">{profile.name}</strong><span className="block text-xs text-muted-foreground">{EMPLOYEE.role} · {EMPLOYEE.location}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{profile.email}</span><span className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-success" /><span><strong className="font-semibold text-foreground">{copy.scope}:</strong> Belgium · Payroll · SME · 8 knowledge sources</span></span></span>
                  </div>
                  <div className="border-t p-1.5">
                    <ProfileAction icon={UserRound} label="Profile details" onClick={() => { setProfileOpen(false); showNotice("Profile details opened"); }} />
                    <ProfileAction icon={Link2} label={copy.m365} onClick={() => { setProfileOpen(false); chooseView("m365"); }} />
                    <ProfileAction icon={ShieldCheck} label="Privacy & access" detail="Verified" onClick={() => { setProfileOpen(false); setPrivacyOpen(true); }} />
                    <ProfileAction icon={Settings} label="Preferences" onClick={() => { setProfileOpen(false); showNotice("Preferences opened"); }} />
                     <div className="px-2 pb-2 pt-1">
                       <Label htmlFor="profile-language" className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Languages className="size-4" />Language</Label>
                       <Select value={language} onValueChange={(value) => setLanguage(value as HubLanguage)}>
                         <SelectTrigger id="profile-language" aria-label="Hub language" className="h-9 w-full bg-background"><SelectValue /></SelectTrigger>
                         <SelectContent>{(["English", "Nederlands", "Français", "Deutsch"] as HubLanguage[]).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                       </Select>
                     </div>
                  </div>
                  <div className="border-t p-1.5"><ProfileAction icon={LogOut} label="Sign out" destructive onClick={() => { setProfileOpen(false); void signOutEmployee().catch(() => showNotice("Sign out did not complete.")); }} /></div>
                </div>}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1600px] flex-col">
          <main className="min-w-0 flex-1 px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
            {view === "workspace" && <Workspace question={question} setQuestion={setQuestion} warnings={personalDataWarnings} analyse={analyse} checking={checking} answerVisible={answerVisible} editing={editing} setEditing={setEditing} answer={answer} setAnswer={setAnswer} setEvidenceOpen={setEvidenceOpen} setDialog={setDialog} showNotice={showNotice} language={language} country={country} setCountry={setCountry} customerType={customerType} setCustomerType={setCustomerType} product={product} setProduct={setProduct} reviewWarning={reviewWarning} analysisError={analysisError} copy={copy} certainty={certainty} trustNotes={trustNotes} setEscalateTo={setEscalateTo} firstName={profile.firstName} />}
            {view === "recent" && <RecentView search={search} setSearch={setSearch} onOpen={() => { setView("workspace"); setAnswerVisible(true); }} />}
            {view === "library" && <LibraryView search={search} setSearch={setSearch} setEvidenceOpen={setEvidenceOpen} />}
            {view === "m365" && <M365View copy={copy} showNotice={showNotice} />}
          </main>
        </div>


        {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-shell px-4 py-3 text-sm text-shell-foreground shadow-lg"><CheckCircle2 className="size-4 text-success" />{notice}</div>}
        <EvidenceSheet open={evidenceOpen} setOpen={setEvidenceOpen} />
        <PrivacySheet open={privacyOpen} setOpen={setPrivacyOpen} />
        <ActionDialog kind={dialog} setKind={setDialog} showNotice={showNotice} escalateTo={escalateTo} />
      </div>
    </TooltipProvider>
  );
}

function Workspace({ question, setQuestion, warnings, analyse, checking, answerVisible, editing, setEditing, answer, setAnswer, setEvidenceOpen, setDialog, showNotice, language, country, setCountry, customerType, setCustomerType, product, setProduct, reviewWarning, analysisError, copy, certainty, trustNotes, setEscalateTo, firstName }: { question: string; setQuestion: (v: string) => void; warnings: string[]; analyse: () => Promise<void>; checking: boolean; answerVisible: boolean; editing: boolean; setEditing: (v: boolean) => void; answer: string; setAnswer: (v: string) => void; setEvidenceOpen: (v: boolean) => void; setDialog: (v: DialogKind) => void; showNotice: (v: string) => void; language: HubLanguage; country: string; setCountry: (v: string) => void; customerType: string; setCustomerType: (v: string) => void; product: string; setProduct: (v: string) => void; reviewWarning: string; analysisError: string | null; copy: (typeof hubCopy)[HubLanguage]; certainty: Certainty; trustNotes: string[]; setEscalateTo: (v: string) => void; firstName: string }) {
  return <>
    <PageTitle eyebrow={`${copy.greeting} ${firstName}`} title={copy.title} action={<Badge variant="outline" className="gap-1.5 bg-success-soft text-success"><ShieldCheck className="size-3.5" /> {copy.verified}</Badge>} />
    <section className="border bg-surface-raised shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center gap-2"><MessageSquareText className="size-5 text-primary" /><h2 className="font-display text-base font-bold">{copy.customerQuestion}</h2><Badge variant="secondary" className="ml-auto">Q-2026-01482</Badge></div>
        <Textarea aria-label="Customer question" maxLength={700} value={question} onChange={(event) => setQuestion(event.target.value)} className={`mt-3 min-h-20 resize-none bg-muted px-4 py-3 text-base shadow-none ${warnings.length ? "border-destructive focus-visible:ring-destructive" : "border-0 focus-visible:ring-1"}`} placeholder="Enter the customer's question without names or identifiers…" />
        {warnings.length > 0 && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0" /><strong>Remove personal data before analysis:</strong> {warnings.join(", ")}<Button variant="ghost" size="sm" className="ml-auto h-7 text-destructive" onClick={() => setQuestion("")}><Trash2 /> Clear question</Button></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CountrySelect label={copy.country} value={country} setValue={setCountry} placeholder={copy.searchCountry} /><ContextSelect label={copy.customerType} value={customerType} setValue={setCustomerType} items={[...CUSTOMER_TYPES]} /><ContextSelect label={copy.product} value={product} setValue={setProduct} items={[...PRODUCTS]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" /> {copy.privacy}</p><Button disabled={!question.trim() || warnings.length > 0 || checking} onClick={() => void analyse()}>{checking ? <RefreshCw className="animate-spin" /> : <Sparkles />}{checking ? copy.generating : copy.analyse}</Button></div>
      </div>
    </section>
    {checking && <AccessCheck />}
    {!checking && analysisError && <div role="alert" className="mt-5 flex items-start gap-3 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><strong>Answer unavailable</strong><p className="mt-1 text-foreground">{analysisError}</p><p className="mt-1 text-xs text-muted-foreground">Your question is still here. Review it and try again.</p></div></div>}
    {!checking && !answerVisible && <div className="mt-5 flex min-h-72 flex-col items-center justify-center border border-dashed bg-surface-raised p-8 text-center"><Search className="size-8 text-muted-foreground" /><h2 className="mt-4 font-display text-lg font-bold">Ready for a new question</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Add business context above. Only knowledge available to your role will be searched.</p></div>}
    {!checking && answerVisible && <div className="mt-5 grid animate-rise-in gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-lg border bg-surface-raised shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b p-4 sm:px-5"><div className="flex size-10 items-center justify-center rounded-full bg-info-soft text-info"><Sparkles className="size-6" /></div><div><p className="text-xs font-semibold uppercase text-info">{copy.draft}</p><h2 className="font-display text-xl font-bold">{copy.proposed}</h2><p className="text-xs text-muted-foreground">Read it, check it, then send it.</p></div><div className="ml-auto flex items-center gap-2"><CertaintyBadge level={certainty} labels={copy.certaintyLabels} /></div></div><div className="p-4 sm:p-6">
          {editing ? <Textarea value={answer} maxLength={1400} onChange={(event) => setAnswer(event.target.value)} className="min-h-44 text-lg leading-8" /> : <p className="max-w-3xl text-lg leading-8">{answer}</p>}
          <div className="mt-5 rounded-md border-l-4 border-warning bg-warning-soft px-4 py-3"><div className="flex gap-2.5"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" /><p className="text-[15px] leading-6 text-warning-foreground"><strong>{copy.check}:</strong> {reviewWarning}</p></div></div>
          <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => setDialog("capture")}><Check /> {copy.use}</Button><Button variant="outline" onClick={() => { if (editing) showNotice("Draft changes saved"); setEditing(!editing); }}>{editing ? <Check /> : <Pencil />}{editing ? copy.save : copy.edit}</Button><Button variant="outline" onClick={() => setEvidenceOpen(true)}><FileText /> {copy.evidence}</Button><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Report knowledge issue" onClick={() => setDialog("issue")}><MoreHorizontal /></Button></TooltipTrigger><TooltipContent>Report knowledge issue</TooltipContent></Tooltip></div>
        </div></section>
        <section className="border bg-surface-raised p-4 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Send className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold">{copy.certainty}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ask for the detail that is missing, or send this draft up the line. Each step shows who decides and how quickly they reply.</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setDialog("context")}><MessageSquareText /> {copy.requestContext}</Button>
          </div>
          <ol className="mt-4 space-y-2">
            {escalationPath.map((step) => (
              <li key={step.name}>
                <button type="button" onClick={() => { setEscalateTo(escalationTarget(step)); setDialog("escalate"); }} className="group flex w-full items-center gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{step.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{step.name}</span><Badge variant="outline" className="border-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">{step.level}</Badge></span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{step.role}</span>
                    <span className="mt-1 block text-xs leading-5"><span className="font-medium">{step.can}</span><span className="text-muted-foreground"> · {step.speed}</span></span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-5 text-muted-foreground">Only your question, the draft and evidence you may already open are shared. No customer names or identifiers.</p>
          </div>
        </section>

      </div>
      <aside className="space-y-5"><TrustPanel notes={trustNotes} certainty={certainty} /><section className="border bg-surface-raised p-5 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /><h2 className="font-display font-bold">{copy.needsAttention}</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">An older FAQ disagrees with the active procedure. It was excluded as superseded.</p><Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setEvidenceOpen(true)}>{copy.reviewExcluded}</Button></section>
      </aside>
    </div>}
  </>;
}

function AccessCheck() { return <section className="mt-5 border bg-surface-raised p-6 shadow-sm" aria-live="polite"><div className="mx-auto max-w-2xl"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success"><ShieldCheck /></div><div><h2 className="font-display font-bold">Generating a source-backed draft</h2><p className="mt-1 text-sm text-muted-foreground">Authorised sources are filtered first, then Lovable AI prepares the answer.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><CheckStep icon={UserRoundCheck} label="Employee access" text="Role confirmed" /><CheckStep icon={LockKeyhole} label="Record permissions" text="Checking each source" /><CheckStep icon={Sparkles} label="Answer generation" text="Review will be required" /></div><Progress value={72} className="mt-6 h-1.5" /></div></section>; }
function CheckStep({ icon: Icon, label, text }: { icon: typeof Search; label: string; text: string }) { return <div className="flex items-start gap-2 border-l-2 border-success px-3"><Icon className="mt-0.5 size-4 text-success" /><div><p className="text-xs font-semibold">{label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{text}</p></div></div>; }

function RecentView({ search, setSearch, onOpen }: { search: string; setSearch: (v: string) => void; onOpen: () => void }) {
  const results = recentQuestions.filter((item) => item.question.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle eyebrow="Your activity" title="Recent questions" action={<Button><Plus /> New question</Button>} /><SearchBar value={search} setValue={setSearch} placeholder="Search your recent questions" /><section className="mt-4 border bg-surface-raised shadow-sm"><div className="hidden grid-cols-[110px_minmax(0,1fr)_150px_100px] gap-4 border-b bg-muted/60 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid"><span>Reference</span><span>Question</span><span>Status</span><span>Updated</span></div><div className="divide-y">{results.map((item) => <Button key={item.id} variant="ghost" className="grid h-auto w-full grid-cols-1 justify-items-start gap-2 rounded-none px-4 py-4 text-left hover:bg-muted/60 sm:grid-cols-[110px_minmax(0,1fr)_150px_100px] sm:items-center sm:gap-4 sm:px-5" onClick={onOpen}><span className="text-xs font-semibold text-muted-foreground">{item.id}</span><span className="min-w-0"><span className="block whitespace-normal text-sm font-semibold">{item.question}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{item.context}</span></span><StatusBadge status={item.status} /><span className="text-xs font-normal text-muted-foreground">{item.time}</span></Button>)}</div></section></>;
}

function LibraryView({ search, setSearch, setEvidenceOpen }: { search: string; setSearch: (v: string) => void; setEvidenceOpen: (v: boolean) => void }) {
  const results = libraryItems.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle eyebrow="Authorised knowledge" title="Knowledge library" action={<Badge variant="outline" className="gap-1.5 bg-success-soft text-success"><LockKeyhole className="size-3.5" /> 8 sources available</Badge>} /><div className="flex gap-2"><SearchBar value={search} setValue={setSearch} placeholder="Search titles and topics" /><Button variant="outline" size="icon" aria-label="Filter knowledge"><Filter /></Button></div><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-success" /> Results only include records you are currently permitted to open.</p><section className="mt-4 border bg-surface-raised shadow-sm"><div className="divide-y">{results.map((source) => <SourceRow key={source.title} {...source} onOpen={() => setEvidenceOpen(true)} />)}</div></section></>;
}


function PageTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) { return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold text-primary">{eyebrow}</p><h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{title}</h1></div><div className="hidden sm:block">{action}</div></div>; }
function SearchBar({ value, setValue, placeholder }: { value: string; setValue: (v: string) => void; placeholder: string }) { return <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-10 bg-surface-raised pl-9" /></div>; }
function StatusBadge({ status }: { status: string }) { const cls = status === "Validated" || status === "Answer ready" ? "bg-success-soft text-success" : status === "Needs context" ? "bg-warning-soft text-warning-foreground" : "bg-info-soft text-info"; return <Badge className={`${cls} border-0 hover:${cls}`}>{status}</Badge>; }

function EvidenceSheet({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) { return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle className="font-display text-xl">Evidence review</SheetTitle><SheetDescription>Only sources within your authorised scope are shown.</SheetDescription></SheetHeader><div className="mt-6 space-y-6"><div><h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Included · 3 sources</h3><div className="divide-y border">{sourceItems.map((source) => <SourceRow key={source.title} {...source} compact />)}</div></div><div><h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Excluded · 2 sources</h3><div className="space-y-2">{excludedItems.map((item) => <div key={item.title} className="border bg-muted p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning-foreground"><XCircle className="size-3.5" />{item.reason}</p></div><Badge variant="outline" className="shrink-0 text-warning-foreground">{item.tag}</Badge></div></div>)}</div></div><div className="border-l-2 border-info bg-info-soft p-4"><p className="text-sm font-semibold">Access is checked each time you open a source.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Results outside your role and record permissions are never retrieved or included in the answer.</p></div></div></SheetContent></Sheet>; }

function PrivacySheet({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) { return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle className="font-display text-xl">Privacy & access</SheetTitle><SheetDescription>How this workspace handles questions and knowledge access.</SheetDescription></SheetHeader><div className="mt-6 space-y-6"><PrivacyRow icon={ShieldCheck} title="Purpose" text="Questions are used to help you prepare an evidence-backed customer response." /><PrivacyRow icon={Trash2} title="Data minimisation" text="Enter business context only. Names, contact details and national numbers are not needed." /><PrivacyRow icon={Clock3} title="Retention" text="Prototype policy: question activity is shown for 90 days, then scheduled for deletion unless it forms part of an approved knowledge record." /><PrivacyRow icon={Eye} title="Access log" text="Opening a question or source is recorded for security review. Your current session is limited to Belgium, Payroll and SME knowledge." /><PrivacyRow icon={Database} title="Knowledge reuse" text="A resolved answer is never made official automatically. A knowledge owner must review and approve it first." /><div className="border-l-2 border-warning bg-warning-soft p-4"><p className="text-sm font-semibold text-warning-foreground">Prototype notice</p><p className="mt-1 text-xs leading-5 text-warning-foreground">These controls demonstrate the intended experience. Real access enforcement, retention deletion and audit records require backend services.</p></div><Button className="w-full" onClick={() => setOpen(false)}><Check /> Understood</Button></div></SheetContent></Sheet>; }
function PrivacyRow({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) { return <div className="flex gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Icon className="size-4" /></div><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>; }

function ActionDialog({ kind, setKind, showNotice, escalateTo }: { kind: DialogKind; setKind: (v: DialogKind) => void; showNotice: (v: string) => void; escalateTo: string }) {
  const data = kind === "context" ? { title: "Request missing context", desc: "Ask only for business details needed to apply the correct rule.", label: "What information is needed?", placeholder: "Applicable payroll period or correction type…", action: "Copy request", notice: "Context request copied" } : kind === "issue" ? { title: "Report a knowledge issue", desc: "Flag outdated, conflicting or unclear information for the knowledge owner.", label: "Describe the issue", placeholder: "Explain which source or claim needs review…", action: "Submit issue", notice: "Knowledge issue submitted" } : kind === "escalate" ? { title: `Escalate to ${escalateTo}`, desc: "Your question, the draft and the evidence you can already open will be shared. Nothing else is passed on.", label: "Reason for escalation", placeholder: "Explain the uncertainty or exception…", action: "Send for review", notice: `Sent to ${escalateTo}` } : { title: "Record the outcome", desc: "Confirm the response was used. You can propose it for future reuse without making it official.", label: "Outcome note (optional)", placeholder: "Add a short, non-personal outcome note…", action: "Save outcome", notice: "Outcome saved as a review candidate" };
  return <Dialog open={kind !== null} onOpenChange={(open) => { if (!open) setKind(null); }}><DialogContent><DialogHeader><DialogTitle className="font-display">{data.title}</DialogTitle><DialogDescription>{data.desc}</DialogDescription></DialogHeader>{kind === "capture" && <div className="flex items-start gap-3 border-l-2 border-info bg-info-soft p-3 text-xs"><UserRoundCheck className="mt-0.5 size-4 shrink-0 text-info" /><p><strong>Knowledge-owner review required.</strong> This outcome remains a candidate until approved.</p></div>}<div className="space-y-2"><Label htmlFor="action-note">{data.label}</Label><Textarea id="action-note" maxLength={500} placeholder={data.placeholder} className="min-h-28" /><p className="text-xs text-muted-foreground">Do not include customer names or identifiers.</p></div><DialogFooter><Button variant="outline" onClick={() => setKind(null)}>Cancel</Button><Button onClick={() => { setKind(null); showNotice(data.notice); }}>{kind === "escalate" ? <Send /> : <Check />}{data.action}</Button></DialogFooter></DialogContent></Dialog>;
}

function ProfileAction({ icon: Icon, label, detail, destructive = false, onClick }: { icon: typeof Search; label: string; detail?: string; destructive?: boolean; onClick: () => void }) { return <Button role="menuitem" variant="ghost" className={`h-10 w-full justify-start gap-2 px-2 font-normal ${destructive ? "text-destructive hover:text-destructive" : ""}`} onClick={onClick}><Icon className="size-4" /><span>{label}</span>{detail && <span className={`ml-auto text-xs ${detail === "Verified" ? "text-success" : "text-muted-foreground"}`}>{detail}</span>}</Button>; }
function NavItem({ icon: Icon, label, active, count, onClick }: { icon: typeof Search; label: string; active?: boolean; count?: string; onClick: () => void }) { return <Button type="button" variant="ghost" aria-label={label} aria-current={active ? "page" : undefined} onClick={onClick} className={`h-9 shrink-0 snap-center gap-2 whitespace-nowrap rounded-md px-2 text-sm sm:px-3 ${active ? "bg-accent font-semibold text-accent-foreground ring-1 ring-brand-blue/30" : "text-muted-foreground hover:text-foreground"}`}><Icon className="size-4" /><span className={active ? "" : "hidden sm:inline"}>{label}</span>{count && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{count}</span>}</Button>; }
function ContextSelect({ label, value, setValue, items }: { label: string; value: string; setValue: (v: string) => void; items: string[] }) { const id = `context-${label.toLowerCase().replaceAll(" ", "-")}`; return <div className="space-y-1.5"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label><Select value={value} onValueChange={setValue}><SelectTrigger id={id} aria-label={label} className="h-10"><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></div>; }
function CountrySelect({ label, value, setValue, placeholder }: { label: string; value: string; setValue: (v: string) => void; placeholder: string }) { const [open, setOpen] = useState(false); return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} className="h-10 w-full justify-between bg-surface-raised px-3 font-normal shadow-none"><span className="truncate">{value}</span><ChevronDown className="size-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"><Command><CommandInput placeholder={placeholder} /><CommandList><CommandEmpty>No country found.</CommandEmpty><CommandGroup>{COUNTRIES.map((item) => <CommandItem key={item} value={item} onSelect={() => { setValue(item); setOpen(false); }}><Check className={`size-4 ${value === item ? "opacity-100" : "opacity-0"}`} />{item}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>; }
function SourceRow({ icon: Icon, title, meta, tag, tone, excerpt, compact = false, onOpen }: (typeof sourceItems)[number] & { compact?: boolean; onOpen?: () => void }) { const tagClass = tone === "success" ? "bg-success-soft text-success" : "bg-info-soft text-info"; return <div className="flex gap-3 p-4 sm:px-5"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{title}</p><Badge className={`${tagClass} border-0 shadow-none`}>{tag}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{meta}</p>{!compact && <p className="mt-2 text-sm leading-5 text-muted-foreground">{excerpt}</p>}</div><Button variant="ghost" size="icon" aria-label={`Open ${title}`} className="shrink-0" onClick={onOpen}><ArrowRight /></Button></div>; }

function SplashScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <div className="flex items-end gap-2" aria-hidden="true">
        <span className="flex h-7 items-end gap-[3px] pb-0.5"><span className="h-4 w-[3px] -skew-x-[18deg] rounded-full bg-brand-blue" /><span className="h-6 w-[3px] -skew-x-[18deg] rounded-full bg-brand-red" /><span className="h-7 w-[3px] -skew-x-[18deg] rounded-full bg-brand-yellow" /></span>
        <span className="font-display text-[22px] font-semibold leading-none tracking-tight">sd worx</span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}


type M365StatusResult = Awaited<ReturnType<typeof getM365Status>>;
type M365SearchResult = Awaited<ReturnType<typeof searchM365Knowledge>>;

const M365_ICONS = { microsoft_teams: Users, microsoft_outlook: Mail, microsoft_sharepoint: Globe, microsoft_onedrive: FolderOpen } as const;

function waitForM365Code(popup: Window, connectorId: string) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Microsoft connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Microsoft window closed before completion."));
    }, 500);
  });
}

function M365View({ copy, showNotice }: { copy: (typeof hubCopy)[HubLanguage]; showNotice: (message: string) => void }) {
  const [status, setStatus] = useState<M365StatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [term, setTerm] = useState("payroll correction");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<M365SearchResult | null>(null);

  const fetchStatus = useServerFn(getM365Status);
  const startConnect = useServerFn(startM365Connect);
  const finishConnect = useServerFn(completeM365Connection);
  const forgetConnection = useServerFn(disconnectM365Connection);
  const runSearch = useServerFn(searchM365Knowledge);

  const load = async () => {
    setLoading(true);
    try { setStatus(await fetchStatus()); } catch (error) {
      showNotice(error instanceof Error ? error.message : "Microsoft 365 status could not be read.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const connect = async (connectorId: M365ConnectorId, label: string) => {
    const popup = window.open("", "lovable-m365-oauth", "width=600,height=720");
    if (!popup) { showNotice("Popups are blocked. Allow popups and try again."); return; }
    setBusy(connectorId);
    try {
      const { authorizationUrl } = await startConnect({ data: { connectorId } });
      const completion = waitForM365Code(popup, connectorId);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await finishConnect({ data: { code } });
      showNotice(`Connected to ${label}.`);
      await load();
    } catch (error) {
      popup.close();
      showNotice(error instanceof Error ? error.message : `${label} could not be connected.`);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (connectorId: M365ConnectorId, label: string) => {
    setBusy(connectorId);
    try { await forgetConnection({ data: { connectorId } }); showNotice(`Disconnected from ${label}.`); await load(); }
    catch (error) { showNotice(error instanceof Error ? error.message : `${label} could not be disconnected.`); }
    finally { setBusy(null); }
  };

  const search = async () => {
    if (term.trim().length < 2) return;
    setSearching(true); setSearchError(null);
    try { setResults(await runSearch({ data: { term: term.trim() } })); }
    catch (error) { setSearchError(error instanceof Error ? error.message : "The approved areas could not be searched."); }
    finally { setSearching(false); }
  };

  const connectedIds = new Set((status?.connected ?? []).map((item) => item.connectorId));
  const findings = (results?.results ?? []).flatMap((item) => item.findings);
  const failures = (results?.results ?? []).flatMap((item) => item.failures);

  return <>
    <PageTitle eyebrow="Knowledge sources" title={copy.m365Title} action={<Badge variant="outline" className="gap-1.5 bg-success-soft text-success"><Link2 className="size-3.5" /> {connectedIds.size} / {M365_CONNECTORS.length} connected</Badge>} />
    <p className="max-w-3xl text-sm text-muted-foreground">{copy.m365Intro}</p>

    {status?.setupNeeded && <div role="status" className="mt-5 flex items-start gap-3 border-l-2 border-warning bg-warning-soft p-4 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" /><div><strong className="text-warning-foreground">{copy.setupNeeded}</strong><p className="mt-1 text-xs leading-5 text-warning-foreground">{copy.setupDetail}</p></div></div>}

    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {M365_CONNECTORS.map((connector) => {
        const Icon = M365_ICONS[connector.connectorId];
        const isConnected = connectedIds.has(connector.connectorId);
        return <article key={connector.connectorId} className="flex flex-col border bg-surface-raised p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm bg-muted"><Icon className="size-4" /></div>
            <Badge className={isConnected ? "border-0 bg-success-soft text-success hover:bg-success-soft" : "border-0 bg-muted text-muted-foreground hover:bg-muted"}>{isConnected ? copy.connected : copy.notConnected}</Badge>
          </div>
          <h2 className="mt-4 font-display font-bold leading-5">{connector.label}</h2>
          <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{connector.detail}</p>
          <div className="mt-4 flex gap-2">
            {isConnected
              ? <Button variant="outline" size="sm" className="flex-1" disabled={busy === connector.connectorId} onClick={() => void connect(connector.connectorId, connector.short)}><RefreshCw className={busy === connector.connectorId ? "animate-spin" : ""} /> Reconnect</Button>
              : <Button size="sm" className="flex-1" disabled={busy === connector.connectorId || status?.setupNeeded} onClick={() => void connect(connector.connectorId, connector.short)}>{busy === connector.connectorId ? <RefreshCw className="animate-spin" /> : <Link2 />}{copy.connect}</Button>}
            {isConnected && <Button variant="ghost" size="icon" aria-label={`Disconnect ${connector.short}`} disabled={busy === connector.connectorId} onClick={() => void disconnect(connector.connectorId, connector.short)}><Unlink /></Button>}
          </div>
        </article>;
      })}
    </div>

    <section className="mt-5 border bg-surface-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">{copy.approvedAreas}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.areasNote}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw /> Refresh</Button>
      </div>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {!loading && (status?.areas.length ?? 0) === 0 && <p className="mt-4 text-sm text-muted-foreground">{copy.noAreas}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {M365_CONNECTORS.map((connector) => {
          const areas = (status?.areas ?? []).filter((area) => area.connector_id === connector.connectorId);
          return <div key={connector.connectorId} className="border bg-background p-3">
            <p className="text-xs font-semibold">{connector.short}</p>
            {areas.length === 0
              ? <p className="mt-2 text-xs text-muted-foreground">{copy.noAreasConnector}</p>
              : <ul className="mt-2 space-y-2">{areas.map((area) => <li key={`${area.connector_id}-${area.resource_ref}`} className="text-xs"><span className="block font-medium">{area.display_name}</span><span className="block text-muted-foreground">{area.resource_kind} · {area.resource_ref}</span></li>)}</ul>}
          </div>;
        })}
      </div>
    </section>

    <section className="mt-5 border bg-surface-raised p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold">{copy.searchAreas}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.searchAreasNote}</p>
      <div className="mt-4 flex gap-2">
        <SearchBar value={term} setValue={setTerm} placeholder="Search the approved areas…" />
        <Button disabled={searching || term.trim().length < 2 || connectedIds.size === 0} onClick={() => void search()}>{searching ? <RefreshCw className="animate-spin" /> : <Search />}{searching ? copy.searching : copy.searchAreas}</Button>
      </div>
      {searchError && <div role="alert" className="mt-4 flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{searchError}</span></div>}
      {results && <div className="mt-4 space-y-4">
        {findings.length === 0 && <p className="text-sm text-muted-foreground">{copy.noFindings}</p>}
        {findings.length > 0 && <div className="divide-y border">{findings.map((finding, index) => <div key={`${finding.connectorId}-${finding.title}-${index}`} className="flex gap-3 p-4">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-muted"><FileText className="size-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{finding.title}</p><Badge className="border-0 bg-info-soft text-info hover:bg-info-soft">{finding.connectorId.replace("microsoft_", "")}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{finding.area}</p>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{finding.snippet}</p>
          </div>
        </div>)}</div>}
        {failures.length > 0 && <div className="border-l-2 border-warning bg-warning-soft p-4"><p className="text-sm font-semibold text-warning-foreground">{copy.areasUnavailable}</p><ul className="mt-2 space-y-1 text-xs leading-5 text-warning-foreground">{failures.map((failure, index) => <li key={`${failure.area}-${index}`}>{failure.area} — {failure.reason}</li>)}</ul></div>}
      </div>}
      <div className="mt-5 flex items-start gap-2 border-t pt-4"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /><p className="text-xs leading-5 text-muted-foreground">{copy.m365Policy}</p></div>
    </section>
  </>;
}
