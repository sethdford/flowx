---
name: flowx-memory
description: Interact with FlowX memory system using batchtools optimization
---

# FlowX Memory System (Batchtools Optimized)

The memory system provides persistent storage with enhanced batch operations for efficient cross-session and cross-agent collaboration.

## Batch Store Operations
```bash
# Single store (traditional)
npx flowx memory store "key" "value" --namespace project

# Batch store multiple key-value pairs
npx flowx memory batch-store --data '{
  "project_specs": "e-commerce platform requirements",
  "api_design": "RESTful API architecture",
  "db_schema": "PostgreSQL database design"
}' --namespace project

# Bulk import from file
npx flowx memory bulk-import data.json --parallel
```

## Parallel Query Operations
```bash
# Single query (traditional)
npx flowx memory query "search term" --limit 10

# Parallel multi-term search
npx flowx memory batch-query --terms "api,database,authentication" --parallel

# Cross-namespace parallel search
npx flowx memory multi-query "pattern" --namespaces "all" --concurrent
```

## Batch Statistics & Analysis
```bash
# Comprehensive stats across all namespaces
npx flowx memory batch-stats --detailed --parallel

# Analyze memory usage patterns
npx flowx memory analyze --patterns --concurrent

# Generate usage reports
npx flowx memory batch-report --format "json,csv,html"
```

## Bulk Export/Import Operations
```bash
# Export multiple namespaces concurrently
npx flowx memory batch-export --namespaces "project,agents,tasks" --output exports/

# Parallel import with validation
npx flowx memory batch-import --files "*.json" --validate --parallel

# Incremental backup with compression
npx flowx memory backup --incremental --compress --parallel
```

## Enhanced Namespace Operations
```bash
# Create multiple namespaces
npx flowx memory batch-create-ns "feature1,feature2,feature3"

# Clone namespaces in parallel
npx flowx memory batch-clone --source project --targets "dev,test,prod"

# Merge namespaces concurrently
npx flowx memory batch-merge --sources "temp1,temp2" --target main
```

## Advanced Batch Operations

### Parallel Data Processing
```bash
# Transform data across namespaces
npx flowx memory batch-transform --operation "encrypt" --namespaces "sensitive"

# Aggregate data from multiple sources
npx flowx memory batch-aggregate --sources "logs,metrics,events" --operation "summarize"
```

### Concurrent Synchronization
```bash
# Sync memory across agents
npx flowx memory batch-sync --agents "all" --bidirectional

# Replicate to remote storage
npx flowx memory batch-replicate --destinations "s3,gcs" --parallel
```

### Bulk Cleanup Operations
```bash
# Clean old data in parallel
npx flowx memory batch-clean --older-than "30d" --namespaces "all"

# Optimize storage concurrently
npx flowx memory batch-optimize --compact --dedupe --parallel
```

## Performance Optimizations

### Batch Read Operations
```bash
# Prefetch related data
npx flowx memory batch-prefetch --keys "user_*" --cache

# Parallel read with fallback
npx flowx memory batch-read --keys-file keys.txt --fallback-ns default
```

### Batch Write Operations
```bash
# Atomic batch writes
npx flowx memory batch-write --atomic --data updates.json

# Conditional batch updates
npx flowx memory batch-update --if-exists --data changes.json
```

## Monitoring & Analytics

### Real-time Batch Monitoring
```bash
# Monitor batch operations
npx flowx memory monitor --batch-ops --real-time

# Track memory usage patterns
npx flowx memory track --patterns --visualize
```

### Performance Analysis
```bash
# Analyze batch operation performance
npx flowx memory perf-analyze --operations "read,write,query"

# Generate optimization recommendations
npx flowx memory optimize-suggest --based-on-usage
```

## Best Practices for Batch Operations
- Use `--parallel` for independent operations
- Enable `--atomic` for data consistency
- Leverage `--cache` for repeated reads
- Use `--stream` for large datasets
- Enable `--compress` for network transfers
- Set `--batch-size` based on memory limits
- Use `--retry` for resilient operations
- Enable `--validate` for data integrity

## Examples of Complex Workflows

### Project Initialization
```bash
# Initialize complete project memory in parallel
npx flowx memory batch-init --template "web-app" --namespaces "specs,arch,impl,tests"
```

### Data Migration
```bash
# Migrate data between formats
npx flowx memory batch-migrate --from "v1" --to "v2" --transform migrate.js --parallel
```

### Distributed Processing
```bash
# Process memory data across multiple workers
npx flowx memory distribute --operation "analyze" --workers 4 --queue-size 1000
```