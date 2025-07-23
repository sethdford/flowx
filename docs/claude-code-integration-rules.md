# Claude Code Integration Rules

## 🚨 CRITICAL: Official Claude Code Integration Standards

### Core Command Patterns

#### 1. **Non-Interactive Mode (Swarm Integration)**
```bash
# ✅ CORRECT: For automated swarm tasks
claude "your prompt here" --print --dangerously-skip-permissions

# ✅ CORRECT: With piped input
cat file.txt | claude --print "process this content"

# ❌ WRONG: Interactive mode in automation
claude "prompt"  # This starts REPL, not suitable for automation
```

#### 2. **Working Directory Management**
```bash
# ✅ CORRECT: Let Claude auto-detect project root
claude "create files" --print --dangerously-skip-permissions

# ✅ CORRECT: Add specific directories if needed
claude "work on this" --add-dir ./src --add-dir ./tests --print

# ❌ WRONG: Manual directory changing in prompts
claude "cd /some/path && create files"  # Claude manages its own context
```

#### 3. **Permission Management**
```bash
# ✅ CORRECT: Skip permissions for automation
--dangerously-skip-permissions

# ✅ CORRECT: Granular tool control
--allowedTools file_operations,shell_commands
--disallowedTools network_requests

# ❌ WRONG: Using default 'ask' mode in automation
# (Will hang waiting for user confirmation)
```

### Command Structure Rules

#### 1. **Argument Order (MANDATORY)**
```bash
# ✅ CORRECT: Prompt MUST be first argument
claude "your prompt here" --print --dangerously-skip-permissions

# ❌ WRONG: Flags before prompt
claude --print "prompt" --dangerously-skip-permissions
```

#### 2. **Required Flags for Automation**
```bash
# MANDATORY for swarm integration:
--print                          # Non-interactive mode
--dangerously-skip-permissions   # Skip confirmation prompts
```

#### 3. **Optional but Recommended Flags**
```bash
--output-format text            # Explicit format (default)
--max-turns 5                   # Limit agentic behavior
--verbose                       # Debug mode (development only)
--model claude-3-5-sonnet-20241022  # Specific model
```

### Working Directory Patterns

#### 1. **Project Root Detection**
Claude automatically detects project root via:
- `.git` directory
- `package.json` 
- `pyproject.toml`
- Other standard project markers

#### 2. **Directory Scope Rules**
```bash
# ✅ CORRECT: Work in detected project root
cd /path/to/project
claude "create Maven structure" --print --dangerously-skip-permissions

# ✅ CORRECT: Add additional directories
claude "work on this" --add-dir ./external-deps --print

# ❌ WRONG: Manually changing context
claude "cd somewhere else && work" --print
```

### Session Management

#### 1. **Session Persistence**
```bash
# ✅ Resume specific session
claude --resume "session-id-12345" "continue work"

# ✅ Continue most recent
claude --continue "what was I working on?"

# ❌ WRONG: Expecting session persistence without flags
```

#### 2. **Session Context**
- Sessions maintain full file state
- Working directory context preserved
- Tool permissions remembered
- Conversation history included

### Process Integration Rules

#### 1. **STDIO Configuration**
```typescript
// ✅ CORRECT: Always pipe stdin/stdout/stderr
stdio: ['pipe', 'pipe', 'pipe']

// ✅ CORRECT: Always close stdin for non-interactive
if (process.stdin) {
  process.stdin.end();
}

// ❌ WRONG: Ignoring stdin
stdio: ['ignore', 'pipe', 'pipe']  // Claude may hang
```

#### 2. **Environment Variables**
```typescript
// ✅ CORRECT: Preserve important env vars
const env = {
  ...process.env,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  // Don't override PATH, HOME, etc.
}

// ❌ WRONG: Minimal environment
const env = { ANTHROPIC_API_KEY: key }  // May break tool detection
```

### Hooks Integration (.clauderc)

#### 1. **Project Configuration**
```json
{
  "hooks": {
    "prePrompt": ["npm install", "npm run build"],
    "postPrompt": ["npm test", "git add ."],
    "onInstall": ["echo 'Claude added to project'"],
    "onUpdate": ["echo 'Claude updated'"]
  },
  "workingDirectories": ["./src", "./tests"],
  "allowedTools": ["file_operations", "shell_commands"],
  "permissionMode": "allow"
}
```

#### 2. **Hook Environment Variables**
- `$CLAUDE_PROMPT` - Original user prompt
- `$CLAUDE_RESPONSE` - Claude's response
- `$CLAUDE_SESSION_ID` - Current session ID

### Error Handling Patterns

#### 1. **Common Hang Scenarios**
```bash
# ❌ CAUSES HANGS:
claude "prompt"                    # Interactive mode
claude "prompt" --permission-mode ask  # Waits for confirmation
# Process spawned without stdin.end()

# ✅ PREVENTS HANGS:
claude "prompt" --print --dangerously-skip-permissions
# Always close stdin in process spawning
```

#### 2. **Timeout Management**
```typescript
// ✅ CORRECT: Reasonable timeouts
const timeout = 300000; // 5 minutes for complex tasks

// ✅ CORRECT: Progress monitoring
const progressInterval = setInterval(() => {
  logger.info('Claude progress', { elapsed, outputLength });
}, 30000);
```

### Model Selection

#### 1. **Supported Models (Claude Code CLI)**
```bash
# ✅ Available models:
--model claude-3-5-sonnet-20241022  # Latest Sonnet (recommended)
--model claude-3-5-haiku-20241022   # Fast responses
--model claude-3-opus-20240229      # Complex reasoning

# ❌ WRONG: Unsupported models
--model gpt-4  # Not supported by Claude Code
```

### Security and Permissions

#### 1. **Permission Modes**
- `ask` - Prompts for dangerous operations (DEFAULT)
- `allow` - Allows most operations
- `deny` - Read-only mode

#### 2. **Tool Categories**
- `file_operations` - Read/write files
- `shell_commands` - Execute commands
- `network_requests` - HTTP requests
- `code_editing` - Code modifications

#### 3. **Safe Automation Pattern**
```bash
# ✅ RECOMMENDED: Controlled automation
claude "task" --print --dangerously-skip-permissions --allowedTools file_operations

# ⚠️ CAUTION: Full permissions (use sparingly)
claude "task" --print --dangerously-skip-permissions
```

### Swarm Integration Best Practices

#### 1. **Task Execution Pattern**
```typescript
// ✅ CORRECT: Complete command construction
const args = [
  prompt,                           // Prompt FIRST
  '--print',                        // Non-interactive
  '--dangerously-skip-permissions', // Skip prompts
  '--output-format', 'text'         // Explicit format
];
```

#### 2. **Working Directory Setup**
```typescript
// ✅ CORRECT: Ensure directory exists
await fs.mkdir(workingDir, { recursive: true });

// ✅ CORRECT: Set correct cwd in spawn
spawn('claude', args, {
  cwd: workingDir,
  stdio: ['pipe', 'pipe', 'pipe']
});
```

#### 3. **Prompt Optimization**
```typescript
// ✅ CORRECT: Concise, clear instructions
const prompt = `${task.instructions}

Work in the current directory. Create all necessary files and directories.

When complete, provide a brief summary of what was accomplished.`;

// ❌ WRONG: Overly complex prompts (may cause hangs)
const prompt = `Very long prompt with 50+ lines of instructions...`;
```

### Debugging and Monitoring

#### 1. **Debug Flags**
```bash
# ✅ Development debugging
claude "prompt" --verbose --print --dangerously-skip-permissions

# ✅ JSON output for parsing
claude "prompt" --output-format json --print
```

#### 2. **Log Monitoring**
```typescript
// ✅ CORRECT: Monitor all streams
process.stdout.on('data', (data) => {
  outputBuffer += data.toString();
});

process.stderr.on('data', (data) => {
  errorBuffer += data.toString();
});
```

### Version Management

#### 1. **Update Checks**
```bash
# ✅ Check for updates
claude update

# ✅ Version verification
claude --version
```

#### 2. **Compatibility**
- Always use latest Claude Code CLI version
- Test integration with each update
- Monitor for breaking changes in command structure

---

## Summary: Critical Success Factors

1. **ALWAYS** use `--print --dangerously-skip-permissions` for automation
2. **ALWAYS** put prompt as first argument
3. **ALWAYS** close stdin in process spawning
4. **ALWAYS** specify working directory correctly
5. **NEVER** use interactive mode in swarm tasks
6. **NEVER** rely on default permission prompts in automation
7. **MONITOR** for output hangs and implement timeouts
8. **TEST** commands manually before automation integration 