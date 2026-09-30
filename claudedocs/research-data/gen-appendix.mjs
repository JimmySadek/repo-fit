// Builds the appendix table (every repo with 40+ stars that the searches surfaced) from the raw search data.
import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
const rows = new Map();
for (const [name, stars, pushed, desc] of [...read("all.tsv"), ...read("known.tsv").map(([n, s, p, d]) => [n, s, p, d])]) {
  if (!rows.has(name) && Number(stars) >= 40) rows.set(name, { name, stars: Number(stars), pushed, desc: (desc ?? "").replace(/\|/g, "/") });
}

// cluster, depth (R = README read, O = README opening only, M = metadata and description only)
const C = {
  spec: "Process and spec frameworks",
  mem: "Memory and recall",
  wiki: "LLM wiki and second brain (set aside)",
  inst: "Instruction files (AGENTS.md, CLAUDE.md)",
  board: "Task board",
  start: "Starters and scaffolds",
  learn: "Self-improvement from corrections",
  play: "Named 'playbook'",
  design: "Design-file formats",
  skills: "Skill collections",
  other: "Unrelated or domain-specific",
  trans: "Translation of another repo",
};
const map = {
  "VoltAgent/awesome-design-md": ["design", "M"], "google-labs-code/design.md": ["design", "M"],
  "agentsmd/agents.md": ["inst", "R"], "microsoft/SkillOpt": ["skills", "M"], "wasp-lang/open-saas": ["other", "M"],
  "MrLesk/Backlog.md": ["board", "R"], "gadievron/raptor": ["other", "M"], "microsoft/skills": ["skills", "M"],
  "jsynowiec/node-typescript-boilerplate": ["start", "M"], "ciembor/agent-rules-books": ["inst", "M"],
  "Piebald-AI/tweakcc": ["other", "M"], "skalesapp/skales": ["other", "M"], "BayramAnnakov/claude-reflect": ["learn", "R"],
  "agent0ai/dox": ["inst", "R"], "twostraws/SwiftAgents": ["inst", "M"], "sceneview/sceneview": ["other", "M"],
  "kunchenguid/backpass": ["learn", "O"], "gamedev-skills/awesome-gamedev-agent-skills": ["skills", "M"],
  "GPTomics/bioSkills": ["skills", "M"], "michaelshimeles/skills": ["skills", "R"],
  "lucasrosati/claude-code-memory-setup": ["mem", "M"], "OWASP/secure-agent-playbook": ["play", "R"],
  "bingbing-gui/dotnet-agent-playbook": ["play", "M"], "cloudnative-co/claude-code-starter-kit": ["start", "R"],
  "pavrus117/ai-os-maps-guide": ["start", "M"], "josipjelic/orchestrated-project-template": ["start", "R"],
  "UnpaidAttention/fable5-methodology": ["spec", "O"], "zhaono1/agent-playbook": ["play", "R"],
  "Durafen/Claude-code-memory": ["mem", "M"], "kuitos/opencode-claude-memory": ["mem", "M"],
  "DominikTobureto/awesome-grok-build": ["inst", "M"], "ccsk-org/ccsk-cli": ["start", "R"],
  "debugtheworldbot/msync": ["mem", "M"], "MadAppGang/mnemex": ["mem", "M"], "binarshina/agents-md-templates": ["inst", "M"],
  "hudrazine/claude-code-memory-bank": ["mem", "M"], "github/spec-kit": ["spec", "R"], "thedotmack/claude-mem": ["mem", "O"],
  "TencentCloud/TencentDB-Agent-Memory": ["mem", "M"], "nashsu/llm_wiki": ["wiki", "M"], "AgriciDaniel/claude-obsidian": ["wiki", "O"],
  "inkeep/open-knowledge": ["wiki", "M"], "SamurAIGPT/llm-wiki-agent": ["wiki", "O"], "sdyckjq-lab/llm-wiki-skill": ["wiki", "M"],
  "Astro-Han/karpathy-llm-wiki": ["wiki", "O"], "atomicstrata/llm-wiki-compiler": ["wiki", "M"], "skyllwt/AutoSci": ["wiki", "M"],
  "lucasastorian/llmwiki": ["wiki", "M"], "spec-kitty/spec-kitty": ["spec", "M"], "nvk/llm-wiki": ["wiki", "M"],
  "GanyuanRan/Aegis": ["spec", "R"], "coleam00/claude-memory-compiler": ["wiki", "R"], "yuezhiai/jonex": ["wiki", "M"],
  "wordflowlab/novel-writer": ["other", "M"], "Linfee/spec-kit-cn": ["trans", "M"], "ThibautBaissac/rails_ai_agents": ["skills", "M"],
  "alirezarezvani/ClaudeForge": ["inst", "R"], "rihebty/flow-kit": ["spec", "M"], "loulanyue/spec-kit-zh": ["trans", "M"],
  "wordflowlab/article-writer": ["other", "M"], "doggy8088/spec-kit": ["trans", "M"], "hiFOFA/spec-kit-chinese": ["trans", "M"],
  "VAMFI/claude-user-memory": ["start", "R"], "guiguiyan930-source/game-ui-design-workflow": ["other", "M"],
  "severity1/claude-code-auto-memory": ["inst", "R"], "HelloRuru/claude-memory-engine": ["learn", "R"],
  "textura-agency/next16-claude-starter": ["start", "M"], "trevor-nichols/agentrules-architect": ["inst", "R"],
  "obra/claude-memory-extractor": ["mem", "M"], "srijanshukla18/claude-memory-viz": ["mem", "M"],
  "WhenMoon-afk/claude-memory-mcp": ["mem", "M"], "oratelecom/tokenwar": ["other", "M"],
  "obra/superpowers": ["spec", "R"], "garrytan/gstack": ["spec", "M"], "gsd-build/get-shit-done": ["spec", "M"],
  "bmad-code-org/BMAD-METHOD": ["spec", "M"], "eyaltoledano/claude-task-master": ["board", "M"], "Fission-AI/OpenSpec": ["spec", "R"],
  "oraios/serena": ["other", "M"], "davila7/claude-code-templates": ["start", "M"], "SuperClaude-Org/SuperClaude_Framework": ["spec", "M"],
};

const list = [...rows.values()].sort((a, b) => b.stars - a.stars);
const missing = list.filter((r) => !map[r.name]).map((r) => r.name);
const depthName = { R: "README read", O: "README opening", M: "metadata only" };
const out = [
  "| Stars | Repo | Cluster | How far I checked | Last push | What it says it is |",
  "|---:|---|---|---|---|---|",
  ...list.map((r) => {
    const [c, d] = map[r.name] ?? ["other", "M"];
    return `| ${r.stars.toLocaleString("en-US")} | \`${r.name}\` | ${C[c]} | ${depthName[d]} | ${r.pushed} | ${r.desc.slice(0, 95)} |`;
  }),
];
writeFileSync(new URL("appendix.md", import.meta.url), `${out.join("\n")}\n`);

const byCluster = {};
for (const r of list) {
  const [c, d] = map[r.name] ?? ["other", "M"];
  (byCluster[c] ??= { n: 0, stars: 0, read: 0 });
  byCluster[c].n++;
  byCluster[c].stars += r.stars;
  if (d !== "M") byCluster[c].read++;
}
console.log(`total repos with 40+ stars: ${list.length}; unmapped: ${missing.length ? missing.join(", ") : "none"}`);
const depth = { R: 0, O: 0, M: 0 };
for (const r of list) depth[(map[r.name] ?? ["other", "M"])[1]]++;
console.log(`read README: ${depth.R}, opening: ${depth.O}, metadata only: ${depth.M}`);
for (const [c, v] of Object.entries(byCluster).sort((a, b) => b[1].stars - a[1].stars)) console.log(`${C[c].padEnd(42)} repos ${String(v.n).padStart(2)}  stars ${String(v.stars).padStart(7)}  checked ${v.read}`);
