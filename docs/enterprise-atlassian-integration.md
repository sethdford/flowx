# Enterprise Atlassian Integration

This document covers the JIRA and Confluence integrations added to FlowX enterprise edition, providing seamless project management and documentation synchronization capabilities.

## Table of Contents

- [Overview](#overview)
- [JIRA Integration](#jira-integration)
- [Confluence Integration](#confluence-integration)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The FlowX enterprise Atlassian integration provides:

- **Bidirectional JIRA Synchronization**: Sync issues, statuses, and metadata between FlowX and JIRA
- **Confluence Documentation Management**: Auto-generate and sync documentation with Confluence
- **Real-time Webhooks**: Instant updates via webhook handlers
- **Field Mapping**: Configurable mappings between FlowX and Atlassian systems
- **Bulk Operations**: Efficient batch processing for large datasets

### Key Features

✅ **Real-time sync** with webhook support  
✅ **Custom field mapping** for flexible data translation  
✅ **Bulk operations** for efficient processing  
✅ **Template-based documentation** generation  
✅ **Enterprise security** with audit logging  
✅ **Zero configuration conflicts** - leverages existing infrastructure  

## JIRA Integration

### Architecture

The JIRA integration extends the existing `IssueTracker` and `ProjectManager` without code duplication:

```typescript
import { JiraIntegration } from '../enterprise/jira-integration.ts';
import { ProjectManager } from '../enterprise/project-manager.ts';

// Extends existing infrastructure
const jira = new JiraIntegration(config, projectManager, issueTracker);
```

### Configuration

#### Basic Configuration

```json
{
  "jira": {
    "enabled": true,
    "baseUrl": "https://your-company.atlassian.net",
    "username": "your-email@company.com",
    "apiToken": "${JIRA_API_TOKEN}",
    "projectKey": "FLOWX",
    "syncDirection": "bidirectional",
    "syncInterval": 15
  }
}
```

#### Advanced Configuration

```json
{
  "jira": {
    "enabled": true,
    "baseUrl": "https://your-company.atlassian.net",
    "username": "your-email@company.com",
    "apiToken": "${JIRA_API_TOKEN}",
    "projectKey": "FLOWX",
    "syncDirection": "bidirectional",
    "syncInterval": 15,
    "fieldMappings": {
      "title": "summary",
      "description": "description",
      "priority": "priority",
      "status": "status",
      "assignee": "assignee",
      "reporter": "reporter",
      "labels": "labels",
      "components": "components"
    },
    "customFields": {
      "flowx_agent_id": "customfield_10001",
      "flowx_task_type": "customfield_10002",
      "flowx_complexity": "customfield_10003"
    },
    "webhookSecret": "${JIRA_WEBHOOK_SECRET}",
    "statusMappings": {
      "pending": "To Do",
      "running": "In Progress", 
      "completed": "Done",
      "failed": "Failed"
    },
    "priorityMappings": {
      "critical": "Highest",
      "high": "High",
      "normal": "Medium",
      "low": "Low",
      "background": "Lowest"
    }
  }
}
```

### Usage

#### Initialize JIRA Integration

```typescript
import { JiraIntegration } from '../enterprise/jira-integration.ts';

const jira = new JiraIntegration(config);
await jira.initialize();

// Start syncing
await jira.startSync();
```

#### Create and Sync Issues

```typescript
// Create issue in FlowX that auto-syncs to JIRA
const issue = await jira.createIssue({
  title: "Implement new API endpoint",
  description: "Create RESTful endpoint for user management",
  priority: "high",
  type: "Task",
  assignee: "john.doe@company.com"
});

// Sync specific issue
await jira.syncIssue(issue.id);

// Bulk sync all issues
const result = await jira.bulkSync();
console.log(`Synced ${result.syncedIssues} issues`);
```

#### Handle Webhook Events

```typescript
// Set up webhook handler
jira.on('jira:issue:updated', (event) => {
  console.log(`JIRA issue ${event.issue.key} updated`);
  // Auto-update FlowX task
});

// Process webhook payload
app.post('/webhooks/jira', (req, res) => {
  jira.handleWebhook(req.body, req.headers);
  res.status(200).send('OK');
});
```

### Sync Strategies

#### Bidirectional Sync
- Changes in FlowX automatically sync to JIRA
- JIRA webhook updates sync back to FlowX
- Conflict resolution with last-modified wins

#### FlowX to JIRA
- One-way sync from FlowX to JIRA
- FlowX is the source of truth
- Useful for automated task creation

#### JIRA to FlowX
- One-way sync from JIRA to FlowX
- JIRA is the source of truth
- Useful for external project management

## Confluence Integration

### Architecture

The Confluence integration extends the existing `ProjectManager` for documentation management:

```typescript
import { ConfluenceIntegration } from '../enterprise/confluence-integration.ts';

const confluence = new ConfluenceIntegration(config, projectManager);
```

### Configuration

#### Basic Configuration

```json
{
  "confluence": {
    "enabled": true,
    "baseUrl": "https://your-company.atlassian.net/wiki",
    "username": "your-email@company.com", 
    "apiToken": "${CONFLUENCE_API_TOKEN}",
    "spaceKey": "FLOWX",
    "syncDirection": "flowx-to-confluence",
    "autoPublish": true
  }
}
```

#### Advanced Configuration

```json
{
  "confluence": {
    "enabled": true,
    "baseUrl": "https://your-company.atlassian.net/wiki",
    "username": "your-email@company.com",
    "apiToken": "${CONFLUENCE_API_TOKEN}",
    "spaceKey": "FLOWX",
    "syncDirection": "bidirectional",
    "autoPublish": true,
    "templateMapping": {
      "projectOverview": "project-overview-template",
      "apiDocumentation": "api-docs-template", 
      "architectureGuide": "architecture-template",
      "userGuide": "user-guide-template",
      "releaseNotes": "release-notes-template"
    },
    "customMacros": {
      "flowx_agent_list": "flowx-agents",
      "flowx_task_board": "flowx-tasks",
      "flowx_metrics": "flowx-metrics"
    },
    "pageHierarchy": {
      "root": "FlowX Documentation",
      "sections": ["Architecture", "API", "Guides", "Release Notes"]
    }
  }
}
```

### Usage

#### Initialize Confluence Integration

```typescript
import { ConfluenceIntegration } from '../enterprise/confluence-integration.ts';

const confluence = new ConfluenceIntegration(config);
await confluence.initialize();
```

#### Generate and Sync Documentation

```typescript
// Auto-generate project documentation
await confluence.generateProjectDocs(projectId);

// Create custom page
const page = await confluence.createPage({
  title: "API Reference v2.0",
  content: apiDocumentation,
  template: "api-docs-template",
  labels: ["api", "v2.0", "reference"]
});

// Sync documentation
await confluence.syncDocumentation();
```

#### Template-based Generation

```typescript
// Generate using templates
const content = await confluence.renderTemplate('project-overview', {
  projectName: "FlowX Enterprise",
  version: "8.1.0",
  agents: agentList,
  metrics: performanceMetrics
});

await confluence.updatePage(pageId, content);
```

## MCP Integration

Both JIRA and Confluence integrations are exposed through MCP tools:

### Available MCP Tools

#### JIRA Tools (7 tools)
- `jira_sync_issues` - Sync issues between FlowX and JIRA
- `jira_create_issue` - Create new JIRA issue
- `jira_update_issue` - Update existing JIRA issue  
- `jira_webhook_handler` - Handle incoming webhooks
- `jira_field_mapping` - Configure field mappings
- `jira_status_check` - Check sync status
- `jira_bulk_operations` - Perform bulk operations

#### Confluence Tools (6 tools)
- `confluence_sync_docs` - Sync documentation
- `confluence_create_page` - Create new page
- `confluence_update_page` - Update existing page
- `confluence_generate_docs` - Generate documentation
- `confluence_template_render` - Render using templates
- `confluence_space_manage` - Manage spaces

### MCP Configuration

The integrations are automatically available when enterprise mode is enabled:

```json
{
  "env": {
    "FLOWX_ENTERPRISE_FEATURES": "jira,confluence,neural,swarm,memory,monitoring",
    "FLOWX_TOOL_COUNT": "100"
  },
  "capabilities": {
    "jiraIntegration": true,
    "confluenceIntegration": true
  }
}
```

## Best Practices

### Security
- Store API tokens in environment variables
- Use webhook secrets for authentication
- Enable audit logging for all sync operations
- Rotate API tokens regularly

### Performance
- Use bulk operations for large datasets
- Configure appropriate sync intervals
- Monitor webhook delivery status
- Cache frequently accessed data

### Data Consistency
- Use bidirectional sync carefully to avoid conflicts
- Implement proper conflict resolution strategies
- Monitor sync status and errors
- Keep field mappings consistent

### Documentation
- Use templates for consistent formatting
- Automate documentation generation where possible
- Keep documentation synchronized with code changes
- Use Confluence macros for dynamic content

## Troubleshooting

### Common Issues

#### Sync Failures
```typescript
// Check sync status
const status = await jira.getSyncStatus();
if (!status.healthy) {
  console.log('Sync errors:', status.errors);
}

// Retry failed syncs
await jira.retryFailedSyncs();
```

#### Authentication Issues
```bash
# Test API connectivity
curl -H "Authorization: Basic ${ENCODED_CREDENTIALS}" \
  "${JIRA_BASE_URL}/rest/api/3/myself"

# Verify permissions
curl -H "Authorization: Basic ${ENCODED_CREDENTIALS}" \
  "${JIRA_BASE_URL}/rest/api/3/project/${PROJECT_KEY}"
```

#### Webhook Problems
```typescript
// Validate webhook configuration
const webhookStatus = await jira.validateWebhookConfig();
if (!webhookStatus.valid) {
  console.log('Webhook issues:', webhookStatus.issues);
}
```

### Monitoring

Monitor integration health:

```typescript
// Get integration metrics
const metrics = await jira.getMetrics();
console.log({
  syncedIssues: metrics.totalSynced,
  errors: metrics.errorCount,
  avgSyncTime: metrics.averageSyncTime,
  lastSync: metrics.lastSuccessfulSync
});

// Monitor webhook delivery
const webhookMetrics = await jira.getWebhookMetrics();
console.log({
  delivered: webhookMetrics.delivered,
  failed: webhookMetrics.failed,
  pending: webhookMetrics.pending
});
```

## Migration Guide

### From Manual JIRA Management

1. **Export existing JIRA data**
2. **Configure field mappings** to match existing structure
3. **Start with one-way sync** (JIRA to FlowX) 
4. **Validate data integrity** before enabling bidirectional sync
5. **Train team** on new workflow

### From Other Issue Trackers

1. **Export data** from current system
2. **Map data structures** to FlowX format
3. **Import into FlowX** first
4. **Configure JIRA integration** second
5. **Enable sync** after validation

## Support

For enterprise support with Atlassian integrations:

- Check the [Enterprise GitHub Issues](https://github.com/your-org/flowx-enterprise/issues)
- Review [integration logs](#logging) for detailed error information  
- Contact enterprise support for advanced configuration assistance

---

*This integration maintains the zero technical debt policy by extending existing enterprise infrastructure rather than creating duplicate implementations.* 