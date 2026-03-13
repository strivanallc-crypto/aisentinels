# Claude Code Master Reference: Prompting, Efficiency & AWS Optimization

**Project Knowledge File — AI Sentinels / MB Design & Remodel**
**Version 1.0 | March 2026**

## Purpose

This reference was built to stop build-loop waste. If your project is at build 76 with 10 builds bouncing on a single feature (e.g., Google/AWS Cognito login), this guide will show you why it happens and how to stop it. Every principle here is aimed at maximum precision per token — fewer builds, lower cost, better code.

---

## 1. How Claude Code Works (Mental Model)

Claude Code is not a chatbot. It is an autonomous agentic coding environment that lives in your terminal, reads your files, runs commands, modifies code, and makes decisions across multiple steps — all within a context window that has hard limits.

### 1.1 The Four-Phase Agent Loop

Every effective Claude Code session follows this sequence. Deviating from it is the #1 cause of build loops.

1. **EXPLORE** — Claude reads relevant files and builds a mental model of the codebase. Never skip this.
2. **PLAN** — Claude proposes an implementation approach before writing a single line of code. Use Plan Mode (`Shift+Tab` twice).
3. **IMPLEMENT** — Code is written based on the approved plan. Context is focused and targeted.
4. **VERIFY & COMMIT** — Tests run, output is reviewed, changes are committed. Gate before moving on.

> **Root Cause of Build Loops:** Build loops happen when you jump from a vague prompt directly to IMPLEMENT without going through EXPLORE and PLAN. Claude produces a plausible-looking implementation that misses the actual requirement. Then you iterate. Then you iterate again. Each iteration costs tokens, time, and money. PLAN MODE is free. Use it every single time for anything non-trivial.

### 1.2 Context Window — The Most Critical Constraint

Claude has a fixed context window (200K tokens for Sonnet). Everything Claude "knows" about your project during a session lives in this window. Once it fills up, quality degrades fast.

| Threshold | Action |
|-----------|--------|
| At 70% context | Start paying attention — quality begins to drop |
| At 85% context | Hallucinations increase significantly |
| At 90%+ context | Responses become erratic; run `/compact` immediately |

Context is consumed by: your CLAUDE.md file (loaded at every session start), every file Claude reads, every message in the conversation history, and every output Claude generates. You pay for ALL of it on every single message.

### 1.3 What Claude Code Can Do (Tool Access)

- Read, write, and edit files across your project
- Execute bash commands, run tests, call CLI tools (`gh`, `aws`, `sentry-cli`, etc.)
- Interact with Git (commit, branch, PR creation via `gh` CLI)
- Call MCP servers (external APIs, databases, Notion, Figma, AWS services)
- Spawn subagents to work on parallel tasks
- Enforce deterministic behaviors via Hooks (lifecycle shell commands)

---

## 2. The CLAUDE.md File — Your Most Powerful Tool

CLAUDE.md is the single most impactful configuration file in Claude Code. It is automatically loaded into the context window at the start of every session. Think of it as the agent's constitution — the persistent memory of your project.

### 2.1 What to Put in CLAUDE.md

- **Project overview:** what this project does, the tech stack, the architecture
- **Coding standards:** naming conventions, TypeScript strict mode, formatting tools
- **File boundaries:** which directories Claude MUST read vs. which to IGNORE
- **Known gotchas:** past bugs, architecture decisions, anti-patterns to avoid
- **Test and build commands:** exactly how to run tests, lint, and build
- **AWS/cloud conventions:** your specific resource naming, region, account structure
- **Authentication patterns:** your specific auth flow (critical for OAuth/Cognito work)

### 2.2 CLAUDE.md Size Rule — Keep It Under 500 Lines

Every line in CLAUDE.md costs tokens on EVERY message. A 2,000-line CLAUDE.md that covers every edge case will waste tokens on 90% of sessions where those edge cases are irrelevant. Keep your root CLAUDE.md under 500 lines covering only universal project facts. Move specialized instructions (deployment guides, DB migration steps, OAuth flows) into Skills that load on demand.

### 2.3 Tiered Documentation Architecture (The Token Saver)

Instead of one giant CLAUDE.md, use a 3-tier system. This alone can reduce per-session context by 60%+.

**Tier 1: Root CLAUDE.md (Always Loaded — Keep Small)**

```markdown
# PROJECT: AI Sentinels SaaS
# Stack: Next.js 14, Aurora Serverless v2, ElastiCache Redis, AWS Amplify
# AI Engine: Gemini 2.5 Pro
# Auth: AWS Cognito + Google IdP Federation
# Regions: us-east-1 (primary)

## Critical Rules
- NEVER modify /src/sentinels/* without reading ARCHITECTURE.md first
- Auth changes MUST follow /docs/cognito-flow.md exactly
- All DB operations use RPC patterns (see /docs/db-patterns.md)
- Forbidden dirs: /node_modules, /.next, /coverage
```

**Tier 2: Domain Skills (Load On Demand)**

```
.claude/commands/cognito-auth.md  — Only loaded when working on auth
.claude/commands/db.md            — Only loaded when working on DB
.claude/commands/aws-deploy.md    — Only loaded when deploying
.claude/commands/sentinel.md      — Domain Sentinel implementation guides
```

**Tier 3: Reference Docs (Explicitly Referenced)**

```
docs/cognito-flow.md              — Detailed OAuth/Cognito flow
docs/db-patterns.md               — RPC/atomic operation patterns
docs/aws-architecture.md          — AWS resource map and naming
```

> **Key Insight for Your Project:** Your Cognito/Google login build loop likely happened because the full OAuth/Cognito flow was not documented in CLAUDE.md and Claude had to rediscover it each build. Create a `/docs/cognito-flow.md` with the exact flow, all the AWS resource ARNs, user pool IDs, and callback URLs — then reference it from CLAUDE.md. The next time you touch auth, Claude reads it once and executes correctly.

---

## 3. Prompting for Maximum Efficiency

The quality and specificity of your prompt determines how many tokens get wasted. Vague prompts cause exploration loops. Specific prompts cause execution.

### 3.1 The Anatomy of a High-Efficiency Prompt

Structure every non-trivial prompt as:

1. **CONTEXT:** What are we working on? What is the current state?
2. **CONSTRAINT:** What must NOT change? What files are in scope?
3. **TASK:** What specific change do we want?
4. **VERIFY:** How will we know it worked?

**Bad Prompt (Build-Loop Generator):**

```
"Fix the login"
```

Why it fails: Claude doesn't know if it's frontend, backend, Cognito config, or all three. It will explore broadly, fill context, potentially touch wrong files, produce something plausible but wrong, and you'll iterate.

**Good Prompt (Execution Mode):**

```
"Read @docs/cognito-flow.md and @src/auth/handler.ts.
 The Google IdP login redirects correctly to Cognito but the
 callback at /auth/callback throws 'invalid_grant' on token
 exchange. Fix only the token exchange logic in handler.ts
 lines 45-80. Do not touch the redirect URI config. Run
 npm test -- --grep 'auth callback' to verify."
```

### 3.2 File Reference Patterns

Use `@` syntax to explicitly scope what Claude reads. This prevents context pollution from irrelevant files.

| Pattern | Effect |
|---------|--------|
| `@src/auth/handler.ts` | Read this specific file |
| `@docs/cognito-flow.md` | Load this documentation |
| `@src/api/` (avoid) | Too broad — Claude reads everything |

### 3.3 The Four Workflow Phases in Practice

**Phase 1: Explore**
```
"Explain the structure of @src/auth/. What does the Cognito
 token exchange flow look like from the callback handler?"
```

**Phase 2: Plan (Use Plan Mode: Shift+Tab twice)**
```
"I want to add Google OAuth via Cognito federated identity.
 Create a plan that: maintains compatibility with existing
 session management, uses TypeScript strict mode, and keeps
 all existing tests passing. List files to change in order."
```

**Phase 3: Implement**
```
"Implement the plan. Start with @src/auth/cognito.ts.
 After each file, run the relevant test before moving on."
```

**Phase 4: Verify & Commit**
```
"Run all auth tests. If any fail, fix them. Once all pass,
 review changes for security issues, then commit with message
 'feat: add Google OAuth via Cognito federation'"
```

### 3.4 Prompt Anti-Patterns to Eliminate

- **"Make this better"** — no scope, wastes tokens on exploration
- **"Look at the code"** — will read hundreds of files
- **"Fix the bug"** — which bug? in which file? what's the expected behavior?
- **"Refactor everything"** — unbounded scope destroys context
- **"What's wrong?"** — forces Claude to diagnose without data

### 3.5 AWS-Specific Prompting Patterns

When working with AWS infrastructure, give Claude the CLI tools and resource context it needs to act without guessing.

```
"Use 'aws cognito-idp --help' to verify, then check the user
 pool config at arn:aws:cognito-idp:us-east-1:ACCT:userpool/
 us-east-1_XXXXX. The app client ID is YYYYY. Confirm the
 callback URL matches our env var NEXT_PUBLIC_COGNITO_CALLBACK."
```

> **CLI Tools = Most Context-Efficient AWS Interaction:** Tell Claude to use the `aws` CLI, `gh` CLI, and other tools directly rather than having it read AWS documentation or make assumptions. Claude knows these CLIs well. `'Use aws s3 ls to check bucket contents'` is 10x more efficient than `'check if our S3 bucket has the files'` — the latter triggers exploration.

---

## 4. Model Selection — The Economic Lever

Choosing the wrong model is one of the biggest cost multipliers in a Claude Code project. The rule is simple: use the cheapest model that can do the job correctly.

| Model | Best For | When to Use |
|-------|----------|-------------|
| `claude-haiku-4-5` | Simple tasks, exploration, subagents | File reads, small transforms, test runs, CI checks |
| `claude-sonnet-4-6` | Core coding (80% of work) | Feature dev, bug fixes, refactoring, API work |
| `claude-opus-4-6` | Complex architecture | System design, security review, critical planning ONLY |

### 4.1 Model Selection Rules

- **Start EVERY session with Sonnet.** It handles ~80% of coding tasks correctly.
- **Switch to Opus only for:** initial architecture design, complex security review, multi-system integration planning. Never for routine implementation.
- **Use Haiku for subagents** — they do file reads, test runs, and exploration. 80% cheaper, same quality for simple tasks.
- **Switch back to Sonnet** immediately after an Opus planning session.

**Model Switching Commands:**
```
/model sonnet     # Default — use this 80% of the time
/model opus       # Complex planning only — expensive
/model haiku      # Simple tasks, subagents, CI scripts
```

### 4.2 Configure Subagent Model to Haiku

Subagents (spawned via the Task tool) run on Sonnet by default. Override in settings.json for 80% cost savings:

```json
{
  "model": "sonnet",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  }
}
```

### 4.3 Extended Thinking — The Hidden Cost

Extended thinking is enabled by default with a 31,999 token budget. Thinking tokens are billed as output tokens (expensive).

| Setting | Use Case |
|---------|----------|
| `MAX_THINKING_TOKENS=31999` (default) | Full thinking — only needed for complex architecture |
| `MAX_THINKING_TOKENS=10000` | Balanced — good for most feature development |
| `MAX_THINKING_TOKENS=0` | Disabled — use for simple tasks, file edits, formatting |

> **Thinking Tokens Warning:** Reducing `MAX_THINKING_TOKENS` from 31,999 to 10,000 cuts thinking-related costs by ~70% on tasks that don't need deep reasoning. Disable it entirely for tasks like "add error handling to these 3 files" or "update the README". Enable full thinking only for architectural decisions.

---

## 5. Context Management — Stop Paying for Irrelevance

Context management is the highest-leverage optimization available. The more irrelevant context Claude processes per message, the more you pay and the worse the outputs become.

### 5.1 The Three Context Commands

**`/compact` — Use Every 30-45 Minutes**

Compresses conversation history into a summary. Reduces input tokens per subsequent message. Think of it as a checkpoint.

**`/clear` — Use When Switching Topics**

Wipes the conversation entirely. Start fresh. Use whenever you finish a task and move to something different.

**`/cost` — Track Your Spending**

Shows session token usage and cost.

### 5.2 Auto-Compaction Setting

By default, auto-compaction triggers at 95% context capacity — by then, quality has already degraded. Override to compact at 50%:

```
CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50
```

### 5.3 Context Anti-Patterns

- Loading all of CLAUDE.md for a README update — use tiered docs
- Asking Claude to "read all files in src/" — always scope to specific files
- Long sessions without `/compact` — history grows, every message costs more
- Debugging by describing the problem instead of providing the error — paste the actual stack trace
- Running broad explorations in main context — use subagents for exploration

### 5.4 Preprocessing Hooks for Large Outputs

Test output, log files, and API responses can dump thousands of tokens into context. Use a PreToolUse hook to filter output before Claude processes it:

```bash
#!/bin/bash
# ~/.claude/hooks/filter-test-output.sh
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command')
if [[ "$cmd" =~ ^(npm test|pytest|go test) ]]; then
  filtered_cmd="$cmd 2>&1 | grep -A 5 -E '(FAIL|ERROR)' | head -100"
  echo '{"hookSpecificOutput":{"permissionDecision":"allow",
        "updatedInput":{"command":"'$filtered_cmd'"}}}'
else
  echo '{}'
fi
```

This ensures Claude only sees test failures — not the full verbose output. Typical savings: 90%+ on test output tokens.

---

## 6. Hooks — Deterministic Control

Hooks are shell commands that execute at specific lifecycle events. Unlike CLAUDE.md instructions (which Claude may or may not follow perfectly), hooks are guaranteed to execute — they are code, not suggestions.

### 6.1 Hook Lifecycle Events

| Event | When It Fires |
|-------|---------------|
| `PreToolUse` | Before Claude executes a tool — can modify or block |
| `PostToolUse` | After tool execution — auto-format, validate, log |
| `UserPromptSubmit` | Before Claude processes your prompt — inject context |
| `Notification` | When Claude sends a notification |
| `Stop` | When Claude finishes — run cleanup, tests |

### 6.2 Essential Hooks for AWS Projects

**Auto-Load AWS Context on Relevant Prompts:**

```bash
#!/bin/bash
# ~/.claude/hooks/user-prompt-submit.sh
PROMPT=$(cat | jq -r '.prompt // empty')
if echo "$PROMPT" | grep -qi 'aws\|cognito\|lambda\|cdk\|amplify'; then
  cat ~/.claude/aws-patterns.md
fi
if echo "$PROMPT" | grep -qi 'auth\|login\|oauth\|cognito'; then
  cat docs/cognito-flow.md
fi
```

**Block Commits Until Tests Pass:**

```bash
#!/bin/bash
# .claude/hooks/pre-commit-gate.sh
if ! [ -f /tmp/tests-passed ]; then
  echo '{"decision":"block","reason":"Run tests first"}'
  exit 0
fi
echo '{}'
```

### 6.3 Hook Configuration (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{"type": "command",
        "command": "~/.claude/hooks/filter-test-output.sh"}]
    }],
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{"type": "command",
        "command": "~/.claude/hooks/user-prompt-submit.sh"}]
    }]
  }
}
```

> **Hooks vs CLAUDE.md Instructions:** Use CLAUDE.md for "should-do" guidance that Claude follows as best practices. Use Hooks for "must-do" rules that cannot be skipped regardless of context. Example: "prefer async/await" -> CLAUDE.md. "always run tests before commit" -> Hook. Build loops are often caused by Claude forgetting a CLAUDE.md rule mid-session. A hook never forgets.

---

## 7. Skills (Custom Slash Commands)

Skills are markdown files in `.claude/commands/` that load specialized context on demand. They are the primary mechanism for keeping CLAUDE.md small while still giving Claude deep domain knowledge when needed.

### 7.1 Creating a Skill

```markdown
# .claude/commands/cognito-auth.md
---
name: cognito-auth
description: AWS Cognito + Google IdP OAuth flow implementation
trigger: Use when implementing or debugging Cognito authentication
---

# Cognito Authentication Patterns

## User Pool Configuration
- Pool ID: us-east-1_XXXXX
- App Client ID: YYYYY
- Callback URL: ${NEXT_PUBLIC_BASE_URL}/auth/callback

## Google IdP Federation Flow
1. User clicks 'Sign in with Google'
2. Redirect to Cognito hosted UI with identity_provider=Google
3. Cognito handles Google OAuth exchange
4. Cognito issues code to callback URL
5. Backend exchanges code for tokens at /oauth2/token
6. Store access_token in httpOnly cookie

## Known Issues
- invalid_grant: Usually means callback URL mismatch in app client config
- 401 on /oauth2/token: Check client_id and client_secret in env
```

### 7.2 Invoking Skills

```
/cognito-auth    # Loads the skill into context
/aws-deploy      # Load deployment procedures
/db-patterns     # Load database RPC patterns
```

### 7.3 Recommended Skills for This Project

- `/cognito-auth` — Full OAuth/Cognito flow with resource IDs
- `/aws-deploy` — Amplify deployment procedures, environment variables
- `/sentinel-domain` — Sentinel architecture (Qualy, Envi, Saffy, Doki, Audie, Nexus)
- `/db-patterns` — Aurora RPC patterns, atomic operations, state machine design
- `/test-strategy` — Test patterns, coverage requirements, CI gates

---

## 8. AWS Optimization with Claude Code

Claude Code is particularly powerful when working with AWS if you configure it properly. The key is giving Claude the right tools, context, and guardrails so it acts as a senior AWS engineer — not an explorer.

### 8.1 Using Claude Code via Amazon Bedrock

Running Claude Code through Amazon Bedrock (instead of the Anthropic API directly) provides enterprise-grade security, IAM-based access control, and cost allocation per developer/team.

**Required IAM Permissions:**
- `bedrock:InvokeModel`
- `bedrock:ListFoundationModels`
- `bedrock:ListInferenceProfiles`
- `aws-marketplace:Subscribe`
- `aws-marketplace:ViewSubscriptions`

**Authentication Approaches (Ordered by Security):**

| Approach | Notes |
|----------|-------|
| Direct IdP Federation (Recommended) | Corporate SSO -> IAM -> Bedrock. Full user attribution, audit trail, cost allocation per dev |
| IAM Roles with Credential Process | Good for teams. Token caching + auto-refresh. No persistent credentials. |
| Short-term API Keys (12hr) | Acceptable for PoC/testing only. No user attribution. |
| Long-term API Keys (NEVER) | Security risk. No MFA. Avoid completely. |

### 8.2 AWS-Specific CLAUDE.md Sections

Add these sections to your root CLAUDE.md to eliminate guessing on every AWS interaction:

```markdown
## AWS Configuration
- Primary Region: us-east-1
- Account ID: [YOUR_ACCT_ID]
- Profile: ai-sentinels-dev
- Naming: {env}-{service}-{resource} (e.g., dev-cognito-userpool)

## Service Inventory
- Cognito User Pool: us-east-1_XXXXX
- Aurora Cluster: ai-sentinels-aurora.cluster-xxx.us-east-1.rds.amazonaws.com
- Amplify App: d1234567890.amplifyapp.com
- ElastiCache: ai-sentinels-redis.xxx.cache.amazonaws.com

## CLI Usage
- Always use 'aws --profile ai-sentinels-dev' prefix
- Use 'aws cognito-idp describe-user-pool --user-pool-id XXXXX' to verify config
- Use 'amplify status' to check deployment state
```

### 8.3 Cognito Authentication Debugging Pattern

The Google/AWS Cognito login that took 10 builds can be reduced to 1-2 with this diagnostic pattern. Add as a skill and invoke at the start of any auth debugging session:

```
/cognito-auth

Diagnose why Google OAuth login fails at token exchange.
Run these checks in order using the aws CLI:

1. aws cognito-idp describe-user-pool-client \
   --user-pool-id [POOL_ID] --client-id [CLIENT_ID]
   -> Verify CallbackURLs includes our callback

2. aws cognito-idp list-identity-providers \
   --user-pool-id [POOL_ID]
   -> Confirm Google IdP is enabled and config is correct

3. Check env vars: COGNITO_CLIENT_SECRET, NEXT_PUBLIC_COGNITO_DOMAIN

4. Reproduce error with: curl -X POST [token_endpoint] \
   -d 'grant_type=authorization_code&code=[CODE]...'

Report findings before writing any code.
```

### 8.4 CDK / Infrastructure Patterns

When generating AWS CDK or CloudFormation code, always provide reference examples from your existing infrastructure. Claude learns your naming conventions, tagging standards, and resource patterns from examples.

> **Few-Shot AWS Prompting:** Paste 2-3 of your existing CDK constructs or CloudFormation snippets into a skill file. When Claude generates new infrastructure, it will automatically follow your patterns — same resource naming, same tagging strategy, same IAM boundary conditions. This eliminates most infra review cycles.

---

## 9. Daily Workflow — The Efficiency Protocol

This is the standard operating procedure for every Claude Code session. Follow it consistently and build loops become rare.

### 9.1 Session Start Checklist

1. `/model sonnet` — Confirm you're on the right model
2. State the task explicitly: what feature, what file, what expected outcome
3. Invoke relevant skill if needed: `/cognito-auth`, `/db-patterns`, etc.
4. Enter Plan Mode (`Shift+Tab` twice) for anything non-trivial
5. Review the plan before allowing implementation to begin

### 9.2 During Session

- Use `/compact` every 30-45 minutes of active work
- After each completed feature/fix: run tests, review diff, commit
- Switch to Opus only when you hit a genuine architectural decision
- Use `@filepath` to scope every file read — never ask Claude to "look around"
- If Claude starts exploring broadly, interrupt: `"Stop. Read only @X and tell me Y"`

### 9.3 Session End Checklist

1. All tests passing
2. Changes committed with descriptive message
3. `/clear` before starting the next task
4. Update CLAUDE.md or relevant skill if you discovered new project facts

### 9.4 The Build Loop Prevention Protocol

If you find yourself on build 3+ for the same feature, stop and run this diagnostic:

**Build Loop Diagnostic — Ask yourself:**

1. Did I give Claude the exact error message, not a description of it?
2. Did I scope to specific files, not directories?
3. Did Claude understand the existing architecture before writing code?
4. Is the relevant skill/doc loaded?
5. Did I use Plan Mode before implementation?

Answering "no" to any of these tells you exactly why the loop is happening.

**Build loop recovery prompt:**
```
"Stop all implementation. Read @[RELEVANT_FILE] and
 @docs/[RELEVANT_DOC] only. Explain back to me in 3 sentences
 what the current implementation does and where it fails.
 Do not write any code yet."
```

---

## 10. Cost Monitoring & Budgeting

### 10.1 Cost Reference (API Usage)

| Model | Input / Output (per million tokens) |
|-------|-------------------------------------|
| Claude Haiku 4.5 | $0.80 / $4 |
| Claude Sonnet 4.6 | $3 / $15 |
| Claude Opus 4.6 | $15 / $75 |

Average developer (Sonnet): ~$6/day, $100-200/month (high variance)

### 10.2 Cost Monitoring Commands

```bash
/cost                              # Session token usage summary
ccusage daily                      # Daily cost breakdown (install ccusage)
ccusage monthly                    # Monthly aggregation
ccusage blocks --live              # Real-time 5-hour billing window tracking
ccusage daily --breakdown          # Per-model breakdown
```

### 10.3 The Subscription vs API Decision

| Plan | Details |
|------|---------|
| Claude Pro ($20/mo) | ~45 messages per 5-hour window. Good for light use. |
| Claude Max 5x ($100/mo) | ~225 messages/5hr. Best for professional solo devs. |
| Claude Max 20x ($200/mo) | ~900 messages/5hr. Heavy daily use, multiple instances. |
| API Pay-per-use | Predictable high-volume work. Best with strict token budgets. |

### 10.4 Cost Optimization Summary

Implementing all techniques in this document can reduce Claude Code costs by 60-80%:

| Technique | Savings |
|-----------|---------|
| Tiered CLAUDE.md (under 500 lines) | Up to 60% reduction in context tokens per session |
| Haiku for subagents | 80% cheaper subagent costs |
| `MAX_THINKING_TOKENS=10000` | ~70% reduction in thinking costs |
| `DISABLE_NON_ESSENTIAL_MODEL_CALLS=1` | Eliminates background API calls |
| PreToolUse test output filtering | 90%+ reduction in test output tokens |
| Specific prompts vs vague prompts | 50%+ reduction per task from fewer iterations |

---

## 11. Quick Reference Card

### Essential Commands

| Command | Action |
|---------|--------|
| `/model sonnet\|opus\|haiku` | Switch active model |
| `/compact` | Compress conversation history |
| `/clear` | Full session reset |
| `/cost` | Show token usage |
| `Shift+Tab` (twice) | Toggle Plan Mode |
| `Shift+Tab` (once) | Toggle auto-accept edits |
| `/[skill-name]` | Load a custom skill |
| `--dangerously-skip-permissions` | Skip permission prompts (dev environments) |

### settings.json Optimization Template

```json
{
  "model": "claude-sonnet-4-6",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-haiku-4-5-20251001",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1"
  }
}
```

### Context Warning Thresholds

| Usage | Action |
|-------|--------|
| 0-70% context | Work freely |
| 70-85% context | Run `/compact` soon |
| 85-90% context | Run `/compact` now — quality degrading |
| 90%+ | Run `/compact` immediately or `/clear` if possible |

### The Golden Rules

1. **PLAN before IMPLEMENT** — always use Plan Mode for non-trivial tasks
2. **SCOPE before reading** — use `@filepath`, never "look at src/"
3. **DOCUMENT before debugging** — load the relevant skill or doc
4. **COMPACT every 30-45 min** — never let context drift to 90%
5. **CLEAR between tasks** — stale context is paid waste
6. **HAIKU for subagents** — never burn Sonnet on exploration
7. **OPUS for architecture only** — never for routine implementation
8. **HOOKS for must-do rules** — CLAUDE.md for should-do guidance

---

*Claude Code Master Reference | AI Sentinels Project | March 2026*
*Sources: docs.anthropic.com/claude-code | aws.amazon.com/bedrock | claudelog.com | claudefa.st*
