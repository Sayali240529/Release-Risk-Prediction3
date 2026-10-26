import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  GitPullRequest,
  GitCommit,
  GitBranch,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Sliders,
  Sparkles,
  Server,
  TrendingUp,
  Cpu,
  Globe,
  ExternalLink,
  ChevronDown,
  Search,
  X,
  Play,
  RotateCcw,
  Layers,
  ArrowUpRight,
  Filter,
  Check,
  Zap,
  BarChart2,
  Code2,
  FileCode,
  Info,
  HelpCircle,
  Radio,
  Send,
  Eye,
  RefreshCw,
  Workflow,
  Copy,
  ChevronRight,
  Shield
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RadarScore {
  subject: string;
  score: number;
  baseline: number;
}

interface DiffHunk {
  type: 'context' | 'addition' | 'deletion';
  line: string;
  flag?: string;
}

interface DiffFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
  hunks: DiffHunk[];
}

interface ReleaseSummary {
  id: string;
  pr_number: number;
  title: string;
  author: string;
  author_role: string;
  branch: string;
  commit_hash: string;
  commit_time: string;
  risk_score: number;
  action: string;
  badge_color: 'green' | 'yellow' | 'red';
  headline: string;
  features?: Record<string, any>;
}

interface ReleaseDetail extends ReleaseSummary {
  repo_name?: string;
  github_url?: string;
  features: Record<string, any>;
  ci_logs: string[];
  radar_scores?: RadarScore[];
  diff_files?: DiffFile[];
  canary_telemetry: {
    current_traffic: string;
    p99_latency_ms: number;
    baseline_p99_ms: number;
    error_rate: string;
    baseline_error_rate: string;
    latency_series?: { time: string; baseline: number; canary: number; err_base?: number; err_canary?: number }[];
  };
  prediction: {
    score: number;
    action: string;
    badge_color: 'green' | 'yellow' | 'red';
    headline: string;
    detail: string;
    top_factors: [string, number][];
  };
  pipeline_stages: {
    name: string;
    status: string;
    time: string;
  }[];
}

const DEFAULT_RADAR: RadarScore[] = [
  { subject: 'Code Churn', score: 75, baseline: 35 },
  { subject: 'Entropy Spread', score: 68, baseline: 40 },
  { subject: 'CI Warnings', score: 80, baseline: 25 },
  { subject: 'Risk Semantics', score: 72, baseline: 20 },
  { subject: 'Canary Drift', score: 65, baseline: 15 },
];

const DEFAULT_LATENCY_SERIES = [
  { time: '10:00', baseline: 175, canary: 178, err_base: 0.01, err_canary: 0.02 },
  { time: '10:05', baseline: 180, canary: 184, err_base: 0.02, err_canary: 0.03 },
  { time: '10:10', baseline: 178, canary: 210, err_base: 0.02, err_canary: 0.08 },
  { time: '10:15', baseline: 182, canary: 285, err_base: 0.02, err_canary: 0.22 },
  { time: '10:20', baseline: 179, canary: 342, err_base: 0.02, err_canary: 0.42 },
];

const SIM_PRESETS = [
  {
    name: '🚨 High Churn Schema Migration',
    desc: 'Altering database indexes and transaction pool with 850 lines changed',
    churn: 850,
    files: 14,
    entropy: 1.85,
    warnings: 8,
    flaky: true,
    text: 'fix(payment): revert schema migration and update transaction retry policy'
  },
  {
    name: '🟢 Safe Typo & Documentation',
    desc: 'Minor markdown update and button copy adjustment with zero CI issues',
    churn: 35,
    files: 2,
    entropy: 0.2,
    warnings: 0,
    flaky: false,
    text: 'docs: update deployment README and fix button label typo'
  },
  {
    name: '⚠️ Security Dependency Upgrade',
    desc: 'OAuth2/JWT token library upgrade with subtle deprecation warnings',
    churn: 320,
    files: 7,
    entropy: 1.15,
    warnings: 6,
    flaky: true,
    text: 'refactor(auth): upgrade oauth2-jwt dependency and fix session timeout'
  },
  {
    name: '🔥 Emergency Null Pointer Patch',
    desc: '1450 line emergency hotfix touching 22 core checkout microservices',
    churn: 1450,
    files: 22,
    entropy: 2.45,
    warnings: 16,
    flaky: true,
    text: 'HOTFIX(core): emergency patch for null pointer crash on order checkout'
  }
];

// ── Main App Component ────────────────────────────────────────────────────────

export default function App() {
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [currentRelease, setCurrentRelease] = useState<ReleaseDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'cockpit' | 'diff' | 'stream' | 'benchmarks' | 'sandbox'>('cockpit');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'warnings' | 'errors'>('all');

  // Modals
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // GitHub Live Search state
  const [githubPrUrl, setGithubPrUrl] = useState<string>('https://github.com/facebook/react/pull/28000');
  const [githubLoading, setGithubLoading] = useState<boolean>(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Sandbox state
  const [simChurn, setSimChurn] = useState<number>(450);
  const [simFiles, setSimFiles] = useState<number>(8);
  const [simEntropy, setSimEntropy] = useState<number>(1.25);
  const [simWarnings, setSimWarnings] = useState<number>(3);
  const [simFlaky, setSimFlaky] = useState<boolean>(false);
  const [simPrText, setSimPrText] = useState<string>('refactor(compiler): update AST transformation pipeline');
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    fetchReleases();
    fetchBenchmarks();
    triggerSimulation(simChurn, simFiles, simEntropy, simWarnings, simFlaky, simPrText);
    const interval = setInterval(fetchReleases, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchReleaseDetail(selectedId);
    }
  }, [selectedId]);

  const fetchReleases = async () => {
    try {
      const res = await fetch('/api/releases');
      if (res.ok) {
        const data = await res.json();
        setReleases(data);
        if (data.length > 0 && (!selectedId || selectedId.startsWith('rel-'))) {
          setSelectedId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReleaseDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/releases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentRelease(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch('/api/benchmarks');
      if (res.ok) {
        const data = await res.json();
        setBenchmarks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeLiveGitHubPr = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || githubPrUrl;
    setGithubLoading(true);
    setGithubError(null);
    try {
      const res = await fetch('/api/github/analyze-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_url: targetUrl }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `GitHub API error (${res.status})`);
      }
      const data: ReleaseDetail = await res.json();
      setCurrentRelease(data);
      setSelectedId(data.id);
      setReleases((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      setShowGithubModal(false);
      setActiveTab('cockpit');
      triggerFeedback(`Analyzed Live PR #${data.pr_number} successfully`);
    } catch (err: any) {
      setGithubError(err.message || 'Failed to fetch GitHub PR');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleFireSimulatedWebhook = async (scenario: 'risky' | 'safe' | 'hotfix') => {
    const payloads = {
      risky: {
        action: "opened",
        number: 104,
        pull_request: {
          number: 104,
          title: "revert(database): roll back concurrent connection pool index",
          body: "Emergency rollback after deadlock alerts in distributed transaction pool.",
          user: { login: "database-sre" },
          head: { ref: "revert/conn-pool-index", sha: "9b12fe4" },
          additions: 820,
          deletions: 490,
          changed_files: 19
        },
        repository: { full_name: "enterprise/cloud-core" }
      },
      safe: {
        action: "opened",
        number: 105,
        pull_request: {
          number: 105,
          title: "docs: update API documentation and fix typo in README",
          body: "Small cleanup of endpoint description and adding usage notes for curl commands.",
          user: { login: "frontend-dev" },
          head: { ref: "docs/readme-cleanup", sha: "1a45b8e" },
          additions: 35,
          deletions: 12,
          changed_files: 2
        },
        repository: { full_name: "enterprise/cloud-core" }
      },
      hotfix: {
        action: "opened",
        number: 106,
        pull_request: {
          number: 106,
          title: "HOTFIX: critical memory leak in websocket connection handler",
          body: "Fixes crash where idle sockets starved server memory under heavy traffic.",
          user: { login: "oncall-engineer" },
          head: { ref: "hotfix/memory-leak", sha: "e77aa10" },
          additions: 610,
          deletions: 180,
          changed_files: 11
        },
        repository: { full_name: "enterprise/cloud-core" }
      }
    };

    try {
      const res = await fetch('/api/webhook/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request'
        },
        body: JSON.stringify(payloads[scenario])
      });
      if (res.ok) {
        const json = await res.json();
        const newRel = json.release;
        setCurrentRelease(newRel);
        setSelectedId(newRel.id);
        setReleases(prev => [newRel, ...prev.filter(r => r.id !== newRel.id)]);
        setShowWebhookModal(false);
        setActiveTab('cockpit');
        triggerFeedback(`⚡ Webhook received! Evaluated PR #${newRel.pr_number} with ${Math.round(newRel.risk_score * 100)}% Risk.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerSimulation = async (churn: number, files: number, entropy: number, warnings: number, flaky: boolean, text: string) => {
    setSimulating(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit_churn: churn,
          files_modified: files,
          directory_entropy: entropy,
          ci_warning_count: warnings,
          ci_flaky_test_flag: flaky ? 1 : 0,
          pr_text: text,
          is_merge_commit: 1,
          author_commit_frequency: 0.04
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const applyPreset = (p: typeof SIM_PRESETS[0]) => {
    setSimChurn(p.churn);
    setSimFiles(p.files);
    setSimEntropy(p.entropy);
    setSimWarnings(p.warnings);
    setSimFlaky(p.flaky);
    setSimPrText(p.text);
    triggerSimulation(p.churn, p.files, p.entropy, p.warnings, p.flaky, p.text);
  };

  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4500);
  };

  const getStatusStyles = (action: string) => {
    switch (action) {
      case 'AUTO_PROMOTE':
        return {
          glow: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
          border: 'border-emerald-500/40',
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20',
          accent: 'text-emerald-400',
          indicator: 'bg-emerald-500',
          gaugeColor: '#10b981',
          shadow: 'shadow-emerald-500/10'
        };
      case 'HOLD_CANARY':
        return {
          glow: 'from-amber-500/20 via-amber-500/5 to-transparent',
          border: 'border-amber-500/40',
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30 ring-1 ring-amber-500/20',
          accent: 'text-amber-400',
          indicator: 'bg-amber-500',
          gaugeColor: '#f59e0b',
          shadow: 'shadow-amber-500/10'
        };
      case 'MANUAL_REVIEW':
      default:
        return {
          glow: 'from-rose-500/20 via-rose-500/5 to-transparent',
          border: 'border-rose-500/40',
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30 ring-1 ring-rose-500/20',
          accent: 'text-rose-400',
          indicator: 'bg-rose-500',
          gaugeColor: '#ef4444',
          shadow: 'shadow-rose-500/10'
        };
    }
  };

  const styles = currentRelease ? getStatusStyles(currentRelease.action) : getStatusStyles('HOLD_CANARY');

  // Format SHAP data for Horizontal BarChart
  const shapChartData = (currentRelease?.prediction.top_factors || []).map(([factor, val]) => ({
    factor: factor.replace(/_/g, ' '),
    fullName: factor,
    impact: Math.round(val * 1000) / 1000,
    color: val >= 0 ? '#ef4444' : '#10b981'
  }));

  const warningCount = (currentRelease?.ci_logs || []).filter(l => l.includes('WARNING') || l.includes('FLAKY')).length;
  const errorCount = (currentRelease?.ci_logs || []).filter(l => l.includes('ERROR') || l.includes('FATAL') || l.includes('NullPointer') || l.includes('timeout') || l.includes('TIMEOUT') || l.includes('Deadlock')).length;

  const filteredLogs = (currentRelease?.ci_logs || []).filter((l) => {
    if (logFilter === 'warnings') return l.includes('WARNING') || l.includes('FLAKY');
    if (logFilter === 'errors') return l.includes('ERROR') || l.includes('FATAL') || l.includes('NullPointer') || l.includes('timeout') || l.includes('TIMEOUT') || l.includes('Deadlock');
    return true;
  });

  const latencyChartData = currentRelease?.canary_telemetry.latency_series || DEFAULT_LATENCY_SERIES;
  const radarChartData = (currentRelease?.radar_scores || DEFAULT_RADAR).map(item => {
    let shortName = item.subject;
    if (shortName.includes('Churn')) shortName = 'Churn';
    else if (shortName.includes('Entropy')) shortName = 'Entropy';
    else if (shortName.includes('Warning')) shortName = 'Warnings';
    else if (shortName.includes('Semantic')) shortName = 'Semantics';
    else if (shortName.includes('Drift') || shortName.includes('Telemetry')) shortName = 'Telemetry';
    return { ...item, subject: shortName };
  });

  return (
    <div className="min-h-screen bg-[#080c15] text-slate-100 flex flex-col font-['Inter',sans-serif] selection:bg-emerald-500/30">
      
      {/* ── TOP ENTERPRISE COMMAND BAR ──────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
            <Shield className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-sm tracking-wider text-white font-mono flex items-center gap-1.5">
                <span>ARGUS</span>
                <span className="text-slate-500">/</span>
                <span className="text-emerald-400">RELEASE-RISK COPILOT</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE CI GATE
              </span>
              <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/60">
                CatBoost v1.2 • SHAP Multimodal Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Context-Aware Automated Canary Gating & Pre-Rollout Risk Intelligence</p>
          </div>
        </div>

        {/* Global Action Triggers */}
        <div className="flex items-center gap-2.5">
          {/* Quick Guide Trigger */}
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <HelpCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Architecture & Workflow</span>
          </button>

          {/* Webhook Simulator Trigger */}
          <button
            onClick={() => setShowWebhookModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/40 transition active:scale-95"
          >
            <Zap className="h-3.5 w-3.5 text-purple-400" />
            <span>Simulate GitHub Webhook</span>
          </button>

          {/* Live GitHub PR Connector */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowGithubModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-500/25 transition border border-indigo-400/30"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Connect Live PR</span>
          </motion.button>

          {/* Cluster Status Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-850/90 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
            <Server className="h-3.5 w-3.5 text-slate-400" />
            <span>k8s: <strong className="text-slate-100">us-east-1</strong></span>
          </div>
        </div>
      </header>

      {/* ── WORKSPACE TABS & NOTIFICATIONS ──────────────────────────── */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 px-6 flex items-center justify-between">
        <nav className="flex space-x-1 py-1.5 text-xs font-semibold">
          {[
            { id: 'cockpit', label: 'Canary Mission Control', icon: <Activity className="h-3.5 w-3.5" /> },
            { id: 'diff', label: 'Code Diff & Safety Scan', icon: <FileCode className="h-3.5 w-3.5" /> },
            { id: 'sandbox', label: 'What-If Signal Sandbox', icon: <Sliders className="h-3.5 w-3.5" /> },
            { id: 'stream', label: `Deployment Stream (${releases.length})`, icon: <Clock className="h-3.5 w-3.5" /> },
            { id: 'benchmarks', label: 'Academic Ablation Study', icon: <TrendingUp className="h-3.5 w-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionFeedback}</span>
          </motion.div>
        )}
      </div>

      {/* ── RELEASE QUEUE HORIZONTAL SELECTOR STRIP ───────────────────── */}
      <div className="border-b border-slate-800/60 bg-slate-950/70 px-6 py-2.5 overflow-x-auto flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono shrink-0 flex items-center gap-1.5">
          <Workflow className="h-3.5 w-3.5 text-slate-400" />
          <span>Active Queue:</span>
        </span>
        <div className="flex items-center gap-2.5">
          {releases.map((rel) => {
            const isSelected = selectedId === rel.id;
            const rStyles = getStatusStyles(rel.action);
            return (
              <button
                key={rel.id}
                onClick={() => {
                  setSelectedId(rel.id);
                  if (activeTab === 'stream' || activeTab === 'benchmarks') setActiveTab('cockpit');
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs text-left transition flex items-center gap-2.5 shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 border-slate-600 ring-2 ring-emerald-500/40 shadow-lg text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <div className={`h-2 w-2 rounded-full ${rStyles.indicator}`}></div>
                <div className="font-mono font-bold text-slate-200">
                  {rel.id.startsWith('gh-') ? '🌐 PR #' : 'PR #'}{rel.pr_number}
                </div>
                <div className="max-w-[180px] truncate text-[11px]">
                  {rel.title}
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase border ${rStyles.badge}`}>
                  {Math.round(rel.risk_score * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTENT ───────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        
        {/* TAB 1: MISSION CONTROL COCKPIT */}
        {activeTab === 'cockpit' && currentRelease && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRelease.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Visual Traffic Routing & DAG Pipeline Stepper */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <span>Real-Time Canary Routing Topology & Gate Stages</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Envoy Proxy Mesh: Active (Traffic Split: 90% Prod / 10% Canary)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {currentRelease.pipeline_stages.map((stage, idx) => {
                    const isGate = stage.name.includes('Risk Gate');
                    let badge = 'bg-slate-850/80 text-slate-400 border-slate-800';
                    let icon = <Clock className="h-3.5 w-3.5" />;

                    if (stage.status === 'passed' || stage.status === 'auto_promote') {
                      badge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                      icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
                    } else if (stage.status === 'holding' || stage.status === 'hold_canary') {
                      badge = 'bg-amber-500/15 text-amber-300 border-amber-500/30 ring-1 ring-amber-500/40';
                      icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
                    } else if (stage.status === 'blocked' || stage.status === 'manual_review') {
                      badge = 'bg-rose-500/15 text-rose-300 border-rose-500/30 ring-1 ring-rose-500/40';
                      icon = <XCircle className="h-3.5 w-3.5 text-rose-400" />;
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs transition flex flex-col justify-between ${badge} ${
                          isGate ? 'bg-slate-850 ring-2 ring-emerald-500/40 shadow-lg' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[10px] text-slate-500 font-bold">STAGE 0{idx + 1}</span>
                          {icon}
                        </div>
                        <span className="font-bold text-slate-100 text-[11px] leading-tight mb-2 truncate">
                          {stage.name}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-auto font-mono">
                          <span className="capitalize">{stage.status.replace('_', ' ')}</span>
                          <span>{stage.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Main Cockpit Split: Left (Signals, Diff preview, CI Logs) & Right (Verdict, SHAP, Radar, Canary telemetry) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* ── LEFT COLUMN (7 COLS): PR Specs, Metric Badges, Terminal ── */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* PR Header & Git Metadata Card */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-emerald-400 font-mono font-bold text-xs bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                            PR #{currentRelease.pr_number}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {currentRelease.repo_name || 'release/core-monorepo'}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
                          {currentRelease.title}
                        </h2>
                      </div>
                      {currentRelease.github_url && (
                        <a
                          href={currentRelease.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 font-semibold shrink-0"
                        >
                          <span>Open in GitHub</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/60 font-mono">
                        <GitBranch className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-200">{currentRelease.branch}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/60 font-mono">
                        <GitCommit className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-200">{currentRelease.commit_hash}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md border border-slate-700/60">
                        <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                        <span>Author: <strong className="text-slate-200">{currentRelease.author}</strong></span>
                      </span>
                      <span className="text-slate-500 font-mono text-[11px] ml-auto">
                        {currentRelease.commit_time}
                      </span>
                    </div>

                    {/* Multimodal Feature Signal Ribbons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
                      <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                          Code Churn
                        </span>
                        <div className="text-base font-bold font-mono">
                          <span className="text-emerald-400">+{currentRelease.features.lines_added}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-rose-400">-{currentRelease.features.lines_deleted}</span>
                        </div>
                      </div>

                      <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                          Files Touched
                        </span>
                        <div className="text-base font-bold font-mono text-slate-100">
                          {currentRelease.features.files_modified} files
                        </div>
                      </div>

                      <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                          Entropy Spread
                        </span>
                        <div className="text-base font-bold font-mono text-slate-100">
                          {currentRelease.features.directory_entropy}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            {currentRelease.features.directory_entropy > 1.2 ? '(Scattered)' : '(Local)'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                          CI Test Duration
                        </span>
                        <div className="text-base font-bold font-mono text-slate-100">
                          {currentRelease.features.ci_test_duration_s}s
                          <span className={`text-[10px] ml-1 font-bold ${currentRelease.features.ci_test_duration_delta > 0.3 ? 'text-amber-400' : 'text-slate-400'}`}>
                            ({currentRelease.features.ci_test_duration_delta > 0 ? '+' : ''}{Math.round(currentRelease.features.ci_test_duration_delta * 100)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Code Diff Snippet Preview */}
                  {currentRelease.diff_files && currentRelease.diff_files.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-slate-850 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-200 font-mono font-bold">
                          <Code2 className="h-4 w-4 text-emerald-400" />
                          <span>AI Scanned Code Modifications (Diff Inspector)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {currentRelease.diff_files.length} file(s) scanned
                        </span>
                      </div>

                      <div className="divide-y divide-slate-800/80">
                        {currentRelease.diff_files.map((file, fIdx) => (
                          <div key={fIdx} className="p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                <FileCode className="h-3.5 w-3.5 text-blue-400" />
                                {file.filename}
                              </span>
                              <span className="text-slate-400">
                                <span className="text-emerald-400">+{file.additions}</span> / <span className="text-rose-400">-{file.deletions}</span>
                              </span>
                            </div>

                            <div className="bg-black/70 rounded-xl p-3 font-mono text-[11px] leading-relaxed overflow-x-auto space-y-0.5 border border-slate-800/60">
                              {file.hunks.map((hunk, hIdx) => {
                                let bg = 'text-slate-400';
                                if (hunk.type === 'addition') bg = 'text-emerald-300 bg-emerald-500/10 px-1 rounded';
                                if (hunk.type === 'deletion') bg = 'text-rose-300 bg-rose-500/10 px-1 rounded';
                                return (
                                  <div key={hIdx} className="flex items-center justify-between">
                                    <span className={bg}>{hunk.line}</span>
                                    {hunk.flag && (
                                      <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                                        ⚠️ {hunk.flag}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Terminal Log Stream with Category Filter Tags */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-850 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-300 font-mono font-bold">
                        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                        <span>CI Runner Execution & Telemetry Log Stream</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setLogFilter('all')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition ${
                            logFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          All ({currentRelease.ci_logs.length})
                        </button>
                        <button
                          onClick={() => setLogFilter('warnings')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition ${
                            logFilter === 'warnings' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-amber-400/80 hover:text-amber-300'
                          }`}
                        >
                          Warnings ({warningCount})
                        </button>
                        <button
                          onClick={() => setLogFilter('errors')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition ${
                            logFilter === 'errors' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-rose-400/80 hover:text-rose-300'
                          }`}
                        >
                          Errors ({errorCount})
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-black/60 font-mono text-[11px] leading-relaxed text-slate-300 max-h-48 overflow-y-auto space-y-1">
                      {filteredLogs.length === 0 ? (
                        <div className="text-slate-500 italic py-4 text-center text-xs font-mono">
                          No log traces matching "{logFilter}" filter.
                        </div>
                      ) : (
                        filteredLogs.map((log, i) => {
                          let color = 'text-slate-400';
                          if (log.includes('WARNING')) color = 'text-amber-400 font-semibold';
                          if (log.includes('ERROR') || log.includes('FATAL') || log.includes('NullPointer') || log.includes('Deadlock') || log.includes('timeout') || log.includes('TIMEOUT')) color = 'text-rose-400 font-semibold';
                          if (log.includes('FLAKY')) color = 'text-fuchsia-400 font-semibold';
                          if (log.includes('Status: All checks green') || log.includes('BUILD SUCCESS') || log.includes('Live GitHub')) color = 'text-emerald-400';

                          return (
                            <div key={i} className="flex gap-2">
                              <span className="text-slate-600 select-none">{String(i + 1).padStart(2, '0')}</span>
                              <span className={color}>{log}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN (5 COLS): Risk Verdict, SHAP, Radar, Canary Latency ── */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Master Decision Card with Radial Risk Gauge */}
                  <div className={`p-6 rounded-2xl border bg-gradient-to-b ${styles.glow} bg-slate-900 ${styles.border} ${styles.shadow} shadow-2xl relative overflow-hidden`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                        Deployment Risk Verdict
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-extrabold uppercase border ${styles.badge}`}>
                        {currentRelease.prediction.action.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-6xl font-black tracking-tight text-white font-mono">
                            {Math.round(currentRelease.prediction.score * 100)}%
                          </span>
                          <span className="text-xs text-slate-400 font-bold uppercase font-mono">Risk Index</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          Threshold: &gt;70% Rollback | 35-70% Hold
                        </div>
                      </div>

                      {/* Mini Radial Visual Indicator */}
                      <div className="h-16 w-16 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
                        <div
                          className="absolute inset-0 rounded-full border-4"
                          style={{
                            borderColor: styles.gaugeColor,
                            clipPath: `polygon(0 0, 100% 0, 100% ${Math.round(currentRelease.prediction.score * 100)}%, 0 ${Math.round(currentRelease.prediction.score * 100)}%)`
                          }}
                        ></div>
                        <span className="font-mono text-xs font-bold text-white">
                          {Math.round(currentRelease.prediction.score * 100)}%
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 leading-snug">
                      {currentRelease.prediction.headline}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-6">
                      {currentRelease.prediction.detail}
                    </p>

                    {/* Operator Action Buttons */}
                    <div className="space-y-2 pt-4 border-t border-slate-800">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                        Operator Policy Directives
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => triggerFeedback('Rollout promoted to 100% production traffic')}
                          className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          <span>Promote (100%)</span>
                        </button>
                        <button
                          onClick={() => triggerFeedback('Canary traffic holding at 10% for 30m soak evaluation')}
                          className="py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Clock className="h-4 w-4" />
                          <span>Hold Canary (30m)</span>
                        </button>
                      </div>
                      <button
                        onClick={() => triggerFeedback('Emergency Rollback executed! 100% traffic shifted back to stable baseline.')}
                        className="w-full py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/10"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Trigger Instant Automated Rollback</span>
                      </button>
                    </div>
                  </div>

                  {/* SHAP Factor Attribution Chart */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-mono">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        <span>SHAP Multimodal Factor Attribution</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                        TreeExplainer
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Quantitative impact showing which features increased (Red) or mitigated (Green) release failure risk:
                    </p>

                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={shapChartData}
                          margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                          <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis type="category" dataKey="factor" stroke="#cbd5e1" fontSize={10} tickLine={false} width={130} />
                          <RechartsTooltip
                            content={({ payload }) => {
                              if (!payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                                  <div className="font-bold text-slate-100 mb-1">{d.fullName}</div>
                                  <div className={d.impact >= 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                                    SHAP Value: {d.impact >= 0 ? '+' : ''}{d.impact}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    {d.impact >= 0 ? 'Pushes release toward failure' : 'Indicates stability and mitigates risk'}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <ReferenceLine x={0} stroke="#94a3b8" />
                          <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                            {shapChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Multimodal 5-Axis Radar Chart & Canary Telemetry */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Multimodal Risk Profile Radar */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                          Multimodal Risk Radar
                        </span>
                      </div>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart outerRadius={46} margin={{ top: 10, right: 30, bottom: 10, left: 30 }} data={radarChartData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" stroke="#cbd5e1" fontSize={10} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={8} />
                            <Radar name="Release" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                            <Radar name="Baseline" dataKey="baseline" stroke="#64748b" fill="#64748b" fillOpacity={0.15} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-400"></span> Current Release
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-slate-500"></span> Safe Baseline
                        </span>
                      </div>
                    </div>

                    {/* Canary Telemetry In-Flight Chart */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                            Canary Latency Drift
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mb-2">
                          p99: <strong className="text-amber-400 font-mono">{currentRelease.canary_telemetry.p99_latency_ms}ms</strong> (Base: {currentRelease.canary_telemetry.baseline_p99_ms}ms)
                        </div>
                      </div>

                      <div className="h-28 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={latencyChartData}>
                            <defs>
                              <linearGradient id="canaryGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[120, 500]} />
                            <Area type="monotone" dataKey="canary" stroke="#f59e0b" strokeWidth={2} fill="url(#canaryGrad)" />
                            <Area type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 text-center pt-1 border-t border-slate-800">
                        Error Rate: <span className="text-amber-400 font-bold">{currentRelease.canary_telemetry.error_rate}</span> (vs {currentRelease.canary_telemetry.baseline_error_rate})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* TAB 2: CODE DIFF & SAFETY SCAN */}
        {activeTab === 'diff' && currentRelease && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-emerald-400" />
                  Code Diff Inspector & Syntactic Risk Annotations
                </h2>
                <p className="text-xs text-slate-400">
                  Inspecting commit <code className="text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded">{currentRelease.commit_hash}</code> on branch <code className="text-slate-300">{currentRelease.branch}</code>
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
                Total Churn: +{currentRelease.features.lines_added} / -{currentRelease.features.lines_deleted}
              </span>
            </div>

            {currentRelease.diff_files && currentRelease.diff_files.length > 0 ? (
              <div className="space-y-4">
                {currentRelease.diff_files.map((file, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-200 flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-blue-400" />
                        {file.filename}
                      </span>
                      <span className="text-slate-400">
                        <span className="text-emerald-400 font-bold">+{file.additions}</span> / <span className="text-rose-400 font-bold">-{file.deletions}</span> lines
                      </span>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto space-y-1">
                      {file.hunks.map((h, hIdx) => {
                        let rowStyle = 'text-slate-400';
                        if (h.type === 'addition') rowStyle = 'text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded';
                        if (h.type === 'deletion') rowStyle = 'text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded';

                        return (
                          <div key={hIdx} className="flex items-center justify-between hover:bg-slate-900/60 px-1 py-0.5 rounded">
                            <span className={rowStyle}>{h.line}</span>
                            {h.flag && (
                              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-md border border-amber-500/40 shrink-0 ml-4">
                                ⚠️ {h.flag}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                No code diff files extracted for this simulated release.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WHAT-IF SIGNAL SIMULATOR (NEVER BLANK) */}
        {activeTab === 'sandbox' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-emerald-400" />
                  What-If Release Signal Simulator
                </h2>
                <span className="text-xs font-mono text-slate-400">Live CatBoost & SHAP Inference Engine</span>
              </div>
              <p className="text-xs text-slate-400">
                Adjust features dynamically or click one of the senior developer presets below to test how the AI engine reacts to complex scenarios:
              </p>
            </div>

            {/* Quick 1-Click Scenario Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SIM_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className="p-3.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition hover:border-emerald-500/40 active:scale-95 space-y-1"
                >
                  <div className="font-bold text-xs text-white truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{p.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
              {/* Sliders (6 Cols) */}
              <div className="md:col-span-6 space-y-4 bg-slate-850/70 p-5 rounded-2xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Commit Churn (Lines Changed)</span>
                    <span className="font-mono text-emerald-400 font-bold">{simChurn} lines</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    value={simChurn}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimChurn(val);
                      triggerSimulation(val, simFiles, simEntropy, simWarnings, simFlaky, simPrText);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Files Touched</span>
                    <span className="font-mono text-emerald-400 font-bold">{simFiles} files</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={simFiles}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimFiles(val);
                      triggerSimulation(simChurn, val, simEntropy, simWarnings, simFlaky, simPrText);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Directory Spread (Entropy)</span>
                    <span className="font-mono text-emerald-400 font-bold">{simEntropy}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.05"
                    value={simEntropy}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimEntropy(val);
                      triggerSimulation(simChurn, simFiles, val, simWarnings, simFlaky, simPrText);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">CI Warning Logs</span>
                    <span className="font-mono text-amber-400 font-bold">{simWarnings} warnings</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={simWarnings}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimWarnings(val);
                      triggerSimulation(simChurn, simFiles, simEntropy, val, simFlaky, simPrText);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="sim-flaky"
                    checked={simFlaky}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setSimFlaky(val);
                      triggerSimulation(simChurn, simFiles, simEntropy, simWarnings, val, simPrText);
                    }}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="sim-flaky" className="text-xs text-slate-300 cursor-pointer">
                    Simulate flaky test retry detected in CI test runner
                  </label>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    PR Title / Semantic Intent:
                  </label>
                  <input
                    type="text"
                    value={simPrText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSimPrText(val);
                      triggerSimulation(simChurn, simFiles, simEntropy, simWarnings, simFlaky, val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Real-time Result Card & SHAP (6 Cols) */}
              <div className="md:col-span-6 bg-slate-850/70 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                {simResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono uppercase font-bold">
                        Calculated Model Verdict
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase border ${getStatusStyles(simResult.prediction.action).badge}`}>
                        {simResult.prediction.action.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <div className="text-5xl font-black font-mono text-white">
                        {Math.round(simResult.prediction.score * 100)}%
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Predicted Deployment Failure Probability</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {simResult.prediction.headline}
                    </p>

                    <div className="space-y-2 pt-3 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                        Instant SHAP Attribution for Simulated Features:
                      </span>
                      {simResult.prediction.top_factors.map(([fac, val]: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs items-center bg-slate-900/60 p-2 rounded-lg">
                          <span className="text-slate-200">{fac}</span>
                          <span className={`font-mono font-bold ${val >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {val >= 0 ? '+' : ''}{Number(val).toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Simulating live model response...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEPLOYMENT STREAM */}
        {activeTab === 'stream' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-400" />
                Continuous Delivery Deployment Stream
              </h2>
              <p className="text-xs text-slate-400">All historical releases evaluated by the multimodal AI safety gate:</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/60 font-mono">
                  <tr>
                    <th className="py-3 px-3">Release Proposal</th>
                    <th className="py-3 px-3">Author</th>
                    <th className="py-3 px-3">Commit Hash</th>
                    <th className="py-3 px-3">Risk Index</th>
                    <th className="py-3 px-3">AI Verdict</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {releases.map((rel) => {
                    const rStyles = getStatusStyles(rel.action);
                    return (
                      <tr key={rel.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          <span className="font-mono text-emerald-400 mr-2">PR #{rel.pr_number}</span>
                          {rel.title}
                        </td>
                        <td className="py-3 px-3 text-slate-400">{rel.author}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{rel.commit_hash}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">
                          {Math.round(rel.risk_score * 100)}%
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${rStyles.badge}`}>
                            {rel.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedId(rel.id);
                              setActiveTab('cockpit');
                            }}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                          >
                            Inspect Cockpit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ABLATION BENCHMARKS */}
        {activeTab === 'benchmarks' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Ablation Study: Academic Baseline vs. Multimodal Architecture
                </h2>
                <p className="text-xs text-slate-400">
                  Evaluation demonstrating the incremental lift of CI log telemetry and PR semantic embeddings over the König et al. (2025) baseline:
                </p>
              </div>
              <button
                onClick={() => setActiveTab('cockpit')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
              >
                <span>Back to Canary Cockpit</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-blue-400" />
                <span>
                  <strong>Academic Research Table Note:</strong> This tab displays the global experimental benchmark evaluating all 5 model configurations on our test set. To view the live metrics, code diffs, and SHAP drivers for the active pull request ({currentRelease ? `PR #${currentRelease.pr_number}` : 'selected above'}), click <strong>"Canary Mission Control"</strong>.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700 font-mono">
                  <tr>
                    <th className="py-3 px-3">Model / Configuration</th>
                    <th className="py-3 px-3">PR-AUC (Primary Metric)</th>
                    <th className="py-3 px-3">ROC-AUC</th>
                    <th className="py-3 px-3">F1-Score</th>
                    <th className="py-3 px-3">Evaluation Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {benchmarks.map((row, idx) => {
                    const isProposed = row['Model / Configuration'].includes('Proposed');
                    return (
                      <tr key={idx} className={isProposed ? 'bg-emerald-500/10 font-bold' : 'hover:bg-slate-850/50'}>
                        <td className="py-3 px-3 text-slate-200 font-sans">{row['Model / Configuration']}</td>
                        <td className="py-3 px-3 text-emerald-400">{row['PR-AUC']}</td>
                        <td className="py-3 px-3 text-slate-300">{row['ROC-AUC']}</td>
                        <td className="py-3 px-3 text-slate-300">{row['F1-Score']}</td>
                        <td className="py-3 px-3 font-sans text-slate-400 text-[11px]">
                          {isProposed ? '⭐ Our Full Multimodal System' : 'Single-Source Baseline'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL 1: ARCHITECTURE & WORKFLOW GUIDE ───────────────────── */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Workflow className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">How This Platform Works (Senior Dev Architecture)</h3>
                    <p className="text-xs text-slate-400">Demystifying Pull Requests, CI, and AI Canary Rollouts</p>
                  </div>
                </div>
                <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <GitPullRequest className="h-4 w-4 text-emerald-400" />
                    1. What is a Pull Request (PR)?
                  </span>
                  <p className="text-slate-400">
                    In software teams, engineers never push directly to live customer servers. They create a <strong>Pull Request (PR)</strong>—a proposed bundle of code edits. The PR shows exactly which lines were added, modified, or deleted across which files.
                  </p>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <Terminal className="h-4 w-4 text-blue-400" />
                    2. Why Do Bugs Still Escape CI Tests?
                  </span>
                  <p className="text-slate-400">
                    Traditional CI (Continuous Integration) only checks: <em>"Did tests pass?"</em> (Binary yes/no). But 15-20% of deployments that pass unit tests still cause production outages due to high code churn, scattered file entropy, subtle compiler warnings, or flaky test retries.
                  </p>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <Cpu className="h-4 w-4 text-purple-400" />
                    3. Our AI Solution: Multimodal CatBoost + SHAP
                  </span>
                  <p className="text-slate-400">
                    Extending Philip König et al. (July 2025), our engine extracts <strong>27 multimodal features</strong> across 4 sources:
                  </p>
                  <ul className="list-disc pl-5 text-slate-400 space-y-0.5 mt-1">
                    <li><strong>Git Churn & Directory Entropy:</strong> Lines changed, file scatter across architectural layers.</li>
                    <li><strong>CI Log Telemetry:</strong> Log warning density, execution duration spikes, flaky test flags.</li>
                    <li><strong>PR NLP Semantics:</strong> High-risk keywords like <code>migration</code>, <code>hotfix</code>, <code>revert</code>.</li>
                    <li><strong>Canary Telemetry Soak:</strong> Live p99 latency spikes and error rate deltas on 10% traffic.</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <Activity className="h-4 w-4 text-amber-400" />
                    4. Automated Canary Gating Decisions
                  </span>
                  <p className="text-slate-400">
                    The policy engine translates the risk probability into automated directives:
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-[11px]">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300">
                      <strong>🟢 &lt; 35% Risk:</strong><br />AUTO_PROMOTE (Roll out to 100%)
                    </div>
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300">
                      <strong>🟡 35-70% Risk:</strong><br />HOLD_CANARY (Soak at 10% for 30m)
                    </div>
                    <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300">
                      <strong>🔴 &gt; 70% Risk:</strong><br />ROLLBACK (Immediate abort)
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                >
                  Got It, Close Guide
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: 1-CLICK WEBHOOK SIMULATOR ────────────────────────── */}
      <AnimatePresence>
        {showWebhookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Trigger Inbound GitHub Webhook</h3>
                    <p className="text-xs text-slate-400">Simulates an automated event payload fired from GitHub</p>
                  </div>
                </div>
                <button onClick={() => setShowWebhookModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Select a scenario below to send a live webhook payload directly to <code className="text-purple-400 bg-slate-950 px-1 py-0.5 rounded">POST /api/webhook/github</code>:
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'risky',
                    title: '🚨 PR #204: Revert Billing Schema (Risky)',
                    desc: 'Emergency database revert with 1310 churn, 19 files modified, and flaky tests.',
                    color: 'hover:border-rose-500/50'
                  },
                  {
                    id: 'safe',
                    title: '🟢 PR #205: Documentation & Typo (Safe)',
                    desc: 'Clean 47 lines documentation update with zero warnings and 100% test pass.',
                    color: 'hover:border-emerald-500/50'
                  },
                  {
                    id: 'hotfix',
                    title: '🔥 PR #206: Memory Leak Hotfix (High Priority)',
                    desc: 'Socket concurrency patch with 790 churn and 11 files in networking core.',
                    color: 'hover:border-amber-500/50'
                  }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleFireSimulatedWebhook(s.id as any)}
                    className={`w-full p-3.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-left transition ${s.color} space-y-1`}
                  >
                    <div className="font-bold text-xs text-white">{s.title}</div>
                    <div className="text-[11px] text-slate-400">{s.desc}</div>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowWebhookModal(false)}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: CONNECT LIVE GITHUB PR ──────────────────────────── */}
      <AnimatePresence>
        {showGithubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowGithubModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Connect Real GitHub Pull Request</h3>
                  <p className="text-xs text-slate-400">Queries GitHub REST API live for real diffs, files, and commit logs.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-medium">
                    GitHub Pull Request URL:
                  </label>
                  <input
                    type="text"
                    value={githubPrUrl}
                    onChange={(e) => setGithubPrUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/pull/123"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Try a public open-source PR:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Flask #5000', url: 'https://github.com/pallets/flask/pull/5000' },
                      { label: 'FastAPI #10000', url: 'https://github.com/tiangolo/fastapi/pull/10000' },
                      { label: 'React #28000', url: 'https://github.com/facebook/react/pull/28000' }
                    ].map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setGithubPrUrl(s.url);
                          handleAnalyzeLiveGitHubPr(s.url);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded text-[11px] text-slate-300 transition"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {githubError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{githubError}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowGithubModal(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAnalyzeLiveGitHubPr()}
                    disabled={githubLoading || !githubPrUrl.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {githubLoading ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Querying GitHub API...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-3.5 w-3.5" />
                        <span>Fetch & Score Live PR</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 px-6 py-3 text-xs text-slate-500 flex items-center justify-between">
        <div>
          ARGUS Release-Risk Intelligence Engine • CatBoost + SHAP Multimodal Safety Gate • Extending König et al. (2025)
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Uptime: 99.99% • Gateway: Envoy Mesh • Backend: http://127.0.0.1:8080
        </div>
      </footer>
    </div>
  );
}
