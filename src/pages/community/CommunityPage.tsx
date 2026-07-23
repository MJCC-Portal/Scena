import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, ChatCircle, MagnifyingGlass, PencilSimple, Plus, SealCheck, SignIn, UsersThree } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { ScenaMark } from "../../components/brand/ScenaMark";
import { supabase } from "../../services/supabase/client";

type Category = "all" | "general" | "setup" | "boards" | "displays" | "plans";
type Thread = { id: string; category: Exclude<Category, "all">; title: string; body: string; author_name: string; reply_count: number; is_answered: boolean; created_at: string; last_activity_at: string };
type Reply = { id: string; thread_id: string; body: string; author_name: string; is_accepted: boolean; created_at: string };

const STARTER_THREADS: Thread[] = [
  { id: "starter-pi", category: "setup", title: "How do I keep a Raspberry Pi display running after a power loss?", body: "I am setting up a small lobby network with Raspberry Pi players. What should I configure so the display reconnects and starts Scena again after the power comes back?", author_name: "Scena Team", reply_count: 1, is_answered: true, created_at: "2026-07-23T12:00:00Z", last_activity_at: "2026-07-23T12:15:00Z" },
  { id: "starter-resolution", category: "displays", title: "What resolution should I use for a lobby TV?", body: "I am building my first Board for a 4K television. Should I design at 1920×1080 or match the full 4K panel?", author_name: "Scena Team", reply_count: 1, is_answered: true, created_at: "2026-07-22T12:00:00Z", last_activity_at: "2026-07-22T12:15:00Z" },
  { id: "starter-locations", category: "boards", title: "What is the easiest way to organize content for multiple locations?", body: "I have several locations that share brand content but need different local announcements. How should I structure Boards, Assets, and Sessions?", author_name: "Scena Team", reply_count: 0, is_answered: false, created_at: "2026-07-21T12:00:00Z", last_activity_at: "2026-07-21T12:00:00Z" },
];

const STARTER_REPLIES: Reply[] = [
  { id: "starter-pi-reply", thread_id: "starter-pi", body: "Use a quality power supply, disable screen blanking, enable Chromium to reopen the Scena player on login, and test a full power-cycle before mounting the display. Ethernet is preferred for fixed installations.", author_name: "Scena Team", is_accepted: true, created_at: "2026-07-23T12:15:00Z" },
  { id: "starter-resolution-reply", thread_id: "starter-resolution", body: "Design at the resolution you will operate most often. 1920×1080 is a practical starting point with broad browser support; use 4K when the screen and player are both stable at that resolution and the viewing distance benefits from it.", author_name: "Scena Team", is_accepted: true, created_at: "2026-07-22T12:15:00Z" },
];

const CATEGORY_LABELS: Record<Category, string> = { all: "All topics", general: "General", setup: "Setup", boards: "Boards", displays: "Displays", plans: "Plans" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function CommunityPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>(STARTER_THREADS);
  const [replies, setReplies] = useState<Reply[]>(STARTER_REPLIES);
  const [selectedId, setSelectedId] = useState(STARTER_THREADS[0].id);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [showAsk, setShowAsk] = useState(false);
  const [question, setQuestion] = useState({ title: "", body: "", category: "general" as Exclude<Category, "all"> });
  const [answer, setAnswer] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!supabase) return undefined;
    const client = supabase as any;
    Promise.all([
      client.from("community_threads").select("*").order("last_activity_at", { ascending: false }),
      client.auth.getUser(),
    ]).then(([threadResult, userResult]: [any, any]) => {
      if (!active) return;
      if (threadResult.data?.length) setThreads(threadResult.data);
      if (userResult.data?.user) setCurrentUser(userResult.data.user.user_metadata?.full_name ?? userResult.data.user.email ?? "Scena member");
    });
    return () => { active = false; };
  }, []);

  const filteredThreads = useMemo(() => threads.filter((thread) => {
    const matchesCategory = category === "all" || thread.category === category;
    const query = search.trim().toLowerCase();
    return matchesCategory && (!query || `${thread.title} ${thread.body}`.toLowerCase().includes(query));
  }), [category, search, threads]);

  const selected = threads.find((thread) => thread.id === selectedId) ?? filteredThreads[0] ?? threads[0];
  const selectedReplies = selected ? replies.filter((reply) => reply.thread_id === selected.id) : [];

  useEffect(() => {
    if (!selected || !supabase || selected.id.startsWith("starter-")) return undefined;
    let active = true;
    const client = supabase as any;
    client.from("community_replies").select("*").eq("thread_id", selected.id).order("created_at", { ascending: true }).then(({ data }: { data?: Reply[] }) => {
      if (active && data) setReplies((current) => [...current.filter((reply) => reply.thread_id !== selected.id), ...data]);
    });
    return () => { active = false; };
  }, [selected?.id]);

  async function requireUser() {
    if (!supabase) { navigate("/login"); return null; }
    const { data } = await supabase.auth.getUser();
    if (!data.user) { navigate("/login"); return null; }
    return data.user;
  }

  async function handleAsk(event: React.FormEvent) {
    event.preventDefault();
    const user = await requireUser();
    if (!user || !question.title.trim() || !question.body.trim()) return;
    setSaving(true);
    const authorName = user.user_metadata?.full_name ?? user.email ?? "Scena member";
    const client = supabase as any;
    const { data, error } = await client.from("community_threads").insert({ title: question.title.trim(), body: question.body.trim(), category: question.category, author_id: user.id, author_name: authorName }).select().single();
    setSaving(false);
    if (error) { setNotice(error.message); return; }
    setThreads((current) => [data, ...current]);
    setSelectedId(data.id);
    setQuestion({ title: "", body: "", category: "general" });
    setShowAsk(false);
    setNotice("Your question is live in the community.");
  }

  async function handleAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !answer.trim()) return;
    const user = await requireUser();
    if (!user) return;
    setSaving(true);
    const authorName = user.user_metadata?.full_name ?? user.email ?? "Scena member";
    const client = supabase as any;
    const { data, error } = await client.from("community_replies").insert({ thread_id: selected.id, body: answer.trim(), author_id: user.id, author_name: authorName }).select().single();
    setSaving(false);
    if (error) { setNotice(error.message); return; }
    setReplies((current) => [...current, data]);
    setThreads((current) => current.map((thread) => thread.id === selected.id ? { ...thread, reply_count: thread.reply_count + 1, is_answered: true } : thread));
    setAnswer("");
    setNotice("Your answer was added.");
  }

  return (
    <div className="scena-community">
      <header className="scena-community__topbar"><Link to="/docs" className="scena-community__brand"><span><ScenaMark size={18} color="currentColor" /></span>Scena <small>Community</small></Link><nav><Link to="/docs"><ArrowLeft size={15} /> Docs</Link><Link to="/login"><SignIn size={15} /> {currentUser ? "Account" : "Sign in"}</Link></nav></header>
      <main className="scena-community__main">
        <section className="scena-community__hero"><div><div className="scena-community__eyebrow"><UsersThree size={15} /> CUSTOMER COMMUNITY</div><h1>Build it. Run it.<br /><em>Ask the people doing it.</em></h1><p>Get practical answers from Scena customers and the team building the platform. Browse setup questions, share what worked, and help the next display network go live.</p></div><button className="scena-community__button scena-community__button--primary" type="button" onClick={() => setShowAsk(true)}><Plus size={17} /> Ask a question</button></section>
        <div className="scena-community__notice"><CheckCircle size={16} /> Read without signing in. Sign in to ask questions or add answers.</div>
        <section className="scena-community__workspace">
          <aside className="scena-community__topics"><div className="scena-community__search"><MagnifyingGlass size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the community" aria-label="Search the community" /></div><div className="scena-community__topic-label">TOPICS</div>{(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => <button type="button" key={key} className={category === key ? "is-active" : ""} onClick={() => setCategory(key)}>{CATEGORY_LABELS[key]}<span>{key === "all" ? threads.length : threads.filter((thread) => thread.category === key).length}</span></button>)}<div className="scena-community__topic-callout"><SealCheck size={18} /><strong>Community guidelines</strong><p>Share real setups, protect private credentials, and keep answers useful for the next person.</p><Link to="/docs#players">Read the setup guide <ArrowRight size={13} /></Link></div></aside>
          <div className="scena-community__thread-list"><div className="scena-community__list-heading"><div><span className="scena-community__eyebrow">{filteredThreads.length} CONVERSATIONS</span><h2>Recent questions</h2></div><span className="scena-community__live"><i /> Live community</span></div>{filteredThreads.map((thread) => <button type="button" key={thread.id} className={`scena-community__thread-row${selected?.id === thread.id ? " is-selected" : ""}`} onClick={() => setSelectedId(thread.id)}><div className="scena-community__thread-main"><div className="scena-community__thread-meta"><span>{CATEGORY_LABELS[thread.category]}</span>{thread.is_answered && <b><CheckCircle size={13} /> Answered</b>}</div><h3>{thread.title}</h3><p>{thread.body}</p><small>{thread.author_name} · {formatDate(thread.last_activity_at)}</small></div><div className="scena-community__reply-count"><ChatCircle size={18} /><strong>{thread.reply_count}</strong><span>replies</span></div></button>)}{filteredThreads.length === 0 && <div className="scena-community__empty"><ChatCircle size={30} /><h3>No questions found</h3><p>Try another topic or ask the first question.</p></div>}</div>
          {selected && <article className="scena-community__detail"><div className="scena-community__detail-meta"><span>{CATEGORY_LABELS[selected.category]}</span>{selected.is_answered && <b><CheckCircle size={13} /> Answered</b>}</div><h2>{selected.title}</h2><div className="scena-community__author"><span>{selected.author_name.slice(0, 1).toUpperCase()}</span><div><strong>{selected.author_name}</strong><small>Asked {formatDate(selected.created_at)}</small></div></div><p className="scena-community__detail-body">{selected.body}</p><div className="scena-community__answers"><h3>{selectedReplies.length} {selectedReplies.length === 1 ? "answer" : "answers"}</h3>{selectedReplies.map((reply) => <div className="scena-community__answer" key={reply.id}><div className="scena-community__author"><span>{reply.author_name.slice(0, 1).toUpperCase()}</span><div><strong>{reply.author_name}</strong><small>{formatDate(reply.created_at)}</small></div>{reply.is_accepted && <b><CheckCircle size={14} /> Accepted</b>}</div><p>{reply.body}</p></div>)}<form className="scena-community__answer-form" onSubmit={handleAnswer}><label htmlFor="community-answer">Add an answer</label><textarea id="community-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={currentUser ? "Share what worked for you…" : "Sign in to share an answer…"} rows={3} /><button className="scena-community__button scena-community__button--secondary" type="submit" disabled={saving}><PencilSimple size={16} /> {saving ? "Saving…" : "Post answer"}</button></form></div></article>}
        </section>
        {notice && <div className="scena-community__toast" role="status">{notice}</div>}
      </main>
      <footer className="scena-community__footer"><span>Scena Community</span><span>Learn together. Keep every screen moving.</span><Link to="/docs">Back to docs <ArrowRight size={14} /></Link></footer>
      {showAsk && <div className="scena-community__modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAsk(false); }}><form className="scena-community__modal" onSubmit={handleAsk}><div className="scena-community__modal-top"><div><div className="scena-community__eyebrow">START A CONVERSATION</div><h2>Ask the community</h2></div><button type="button" aria-label="Close" onClick={() => setShowAsk(false)}>×</button></div><p>Describe your setup and what you have tried. Specific details help other customers answer faster.</p><label htmlFor="question-title">Question title</label><input id="question-title" value={question.title} onChange={(event) => setQuestion((current) => ({ ...current, title: event.target.value }))} placeholder="What are you trying to set up?" minLength={8} required /><label htmlFor="question-category">Topic</label><select id="question-category" value={question.category} onChange={(event) => setQuestion((current) => ({ ...current, category: event.target.value as Exclude<Category, "all"> }))}>{Object.entries(CATEGORY_LABELS).filter(([key]) => key !== "all").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label htmlFor="question-body">Details</label><textarea id="question-body" value={question.body} onChange={(event) => setQuestion((current) => ({ ...current, body: event.target.value }))} placeholder="Tell us about the screen, player, plan, or error…" rows={6} minLength={20} required /><div className="scena-community__modal-actions"><button type="button" className="scena-community__button scena-community__button--quiet" onClick={() => setShowAsk(false)}>Cancel</button><button type="submit" className="scena-community__button scena-community__button--primary" disabled={saving}>{saving ? "Posting…" : "Post question"} <ArrowRight size={16} /></button></div></form></div>}
    </div>
  );
}
