---
name: flowx-help
description: Show FlowX commands and usage with batchtools optimization
---

# FlowX Commands (Batchtools Optimized)

## Core Commands with Batch Operations

### System Management (Batch Operations)
- `npx flowx start` - Start orchestration system
- `npx flowx status` - Check system status
- `npx flowx monitor` - Real-time monitoring
- `npx flowx stop` - Stop orchestration

**Batch Operations:**
```bash
# Check multiple system components in parallel
npx flowx batch status --components "agents,tasks,memory,connections"

# Start multiple services concurrently
npx flowx batch start --services "monitor,scheduler,coordinator"
```

### Agent Management (Parallel Operations)
- `npx flowx agent spawn <type>` - Create new agent
- `npx flowx agent list` - List active agents
- `npx flowx agent info <id>` - Agent details
- `npx flowx agent terminate <id>` - Stop agent

**Batch Operations:**
```bash
# Spawn multiple agents in parallel
npx flowx agent batch-spawn "code:3,test:2,review:1"

# Get info for multiple agents concurrently
npx flowx agent batch-info "agent1,agent2,agent3"

# Terminate multiple agents
npx flowx agent batch-terminate --pattern "test-*"
```

### Task Management (Concurrent Processing)
- `npx flowx task create <type> "description"` - Create task
- `npx flowx task list` - List all tasks
- `npx flowx task status <id>` - Task status
- `npx flowx task cancel <id>` - Cancel task

**Batch Operations:**
```bash
# Create multiple tasks from file
npx flowx task batch-create tasks.json

# Check status of multiple tasks concurrently
npx flowx task batch-status --ids "task1,task2,task3"

# Process task queue in parallel
npx flowx task process-queue --parallel 5
```

### Memory Operations (Bulk Processing)
- `npx flowx memory store "key" "value"` - Store data
- `npx flowx memory query "search"` - Search memory
- `npx flowx memory stats` - Memory statistics
- `npx flowx memory export <file>` - Export memory

**Batch Operations:**
```bash
# Bulk store from JSON file
npx flowx memory batch-store data.json

# Parallel query across namespaces
npx flowx memory batch-query "search term" --namespaces "all"

# Export multiple namespaces concurrently
npx flowx memory batch-export --namespaces "project,agents,tasks"
```

### SPARC Development (Parallel Workflows)
- `npx flowx sparc modes` - List SPARC modes
- `npx flowx sparc run <mode> "task"` - Run mode
- `npx flowx sparc tdd "feature"` - TDD workflow
- `npx flowx sparc info <mode>` - Mode details

**Batch Operations:**
```bash
# Run multiple SPARC modes in parallel
npx flowx sparc batch-run --modes "spec:task1,architect:task2,code:task3"

# Execute parallel TDD for multiple features
npx flowx sparc batch-tdd features.json

# Analyze multiple components concurrently
npx flowx sparc batch-analyze --components "auth,api,database"
```

### Swarm Coordination (Enhanced Parallelization)
- `npx flowx swarm "task" --strategy <type>` - Start swarm
- `npx flowx swarm "task" --background` - Long-running swarm
- `npx flowx swarm "task" --monitor` - With monitoring

**Batch Operations:**
```bash
# Launch multiple swarms for different components
npx flowx swarm batch --config swarms.json

# Coordinate parallel swarm strategies
npx flowx swarm multi-strategy "project" --strategies "dev:frontend,test:backend,docs:api"
```

## Advanced Batch Examples

### Parallel Development Workflow:
```bash
# Initialize complete project setup in parallel
npx flowx batch init --actions "memory:setup,agents:spawn,tasks:queue"

# Run comprehensive analysis
npx flowx batch analyze --targets "code:quality,security:audit,performance:profile"
```

### Concurrent Testing Suite:
```bash
# Execute parallel test suites
npx flowx sparc batch-test --suites "unit,integration,e2e" --parallel

# Generate reports concurrently
npx flowx batch report --types "coverage,performance,security"
```

### Bulk Operations:
```bash
# Process multiple files in parallel
npx flowx batch process --files "*.ts" --action "lint,format,analyze"

# Parallel code generation
npx flowx batch generate --templates "api:users,api:products,api:orders"
```

## Performance Tips
- Use `--parallel` flag for concurrent operations
- Batch similar operations to reduce overhead
- Leverage `--async` for non-blocking execution
- Use `--stream` for real-time progress updates
- Enable `--cache` for repeated operations

## Monitoring Batch Operations
```bash
# Real-time batch monitoring
npx flowx monitor --batch

# Batch operation statistics
npx flowx stats --batch-ops

# Performance profiling
npx flowx profile --batch-execution
```