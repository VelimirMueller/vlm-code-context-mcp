I made my AI coding agent argue with a local Gemma 3 model about whether my tool actually works. Then I used the debate to build a statistically rigorous benchmark. Here's what happened.

---

I built vlm-code-context-mcp — an open-source MCP server that gives AI coding agents persistent memory through SQLite. No cloud APIs, no API keys, one file. The claim: ~40% fewer tokens consumed per development task.

But claims without proof are just marketing. So I ran an experiment.

Step 1: I had Claude Opus 4.6 debate Gemma 3 (running locally via Ollama) about whether the tool is actually good. Gemma called the benchmark "cherry-picked" and "highly susceptible to manipulation." It said SQLite was a bottleneck (wrong — it's a single-user local tool). It suggested replacing everything with Pinecone and Kafka microservices (would destroy the 3-command setup). But it was right about the benchmark methodology being weak.

Step 2: Using the debate findings, I built a proper benchmark. 10 tasks across 6 categories (retrieval, analysis, exploration, implementation, debugging, refactoring). Each task simulates a real AI agent workflow: research, locate, understand, implement, verify. Self-contained, deterministic, reproducible. One command: npm test.

Result: 44.9% token savings. Higher than the original 40% estimate.

Step 3: But deterministic benchmarks can still have author bias — I chose which files to read. So I built a stochastic benchmark. 200 randomized trials where files are randomly assigned to roles and vanilla gets Poisson-distributed exploration noise (modeling agents reading wrong files before finding the right one).

The statistics:

- MCP wins: 181/200 trials (90.5%)  
- Wilcoxon signed-rank test: z=11.688, p<0.001  
- Effect size: r=0.953 (large)  
- 95% CI: [17.9%, 44.9%] savings  

H₀ rejected. The savings are real.

The interesting part: every time we made the methodology more rigorous, the numbers went UP, not down. That's the opposite of what happens with cherry-picked results.

Three things I learned:

1. Small local models (Gemma 4.3B) are genuinely useful for adversarial review — they catch surface-level problems that you're blind to. But their architecture recommendations can be destructive (vector databases for a desktop tool is insane).

2. Your intuition about your own tool can be right even when your methodology is wrong. The original 40% estimate was solid. The proof was what was missing.

3. Stochastic benchmarks with proper statistical tests (Wilcoxon, not t-test — token distributions aren't normal) turn marketing claims into scientific claims. It took a few hundred lines of TypeScript. No external dependencies.

The tool: vlm-code-context-mcp on npm  
The debate: GEMMA-VS-OPUS-DEBATE.md in the repo  
The benchmark: npm test -- test/benchmark-stochastic.test.ts  

Zero API keys. One SQLite file. 90.5% win rate.

#AI #MCP #DeveloperTools #OpenSource #Benchmarking #Statistics
