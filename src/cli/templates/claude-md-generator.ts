/**
 * Enhanced CLAUDE.md Template Generator
 * Creates comprehensive CLAUDE.md templates with TodoWrite best practices and batching rules
 * Based on original flowx patterns with modern TypeScript implementation
 */

export interface ProjectContext {
  type: 'web-app' | 'api' | 'cli' | 'library' | 'data-pipeline' | 'microservice' | 'full-stack' | 'generic';
  hasSwarm?: boolean;
  hasMCP?: boolean;
  hasMemory?: boolean;
  agentCount?: number;
  complexity?: 'simple' | 'medium' | 'complex' | 'enterprise';
  frameworks?: string[];
  languages?: string[];
  useSPARC?: boolean;
}

export interface TemplateOptions {
  includeExamples?: boolean;
  includeVisualFormats?: boolean;
  includeBatchValidation?: boolean;
  includeSwarmPatterns?: boolean;
  includeMCPTools?: boolean;
  customInstructions?: string[];
}

export class ClaudeMdGenerator {
  
  /**
   * Generate comprehensive CLAUDE.md content
   */
  static generateTemplate(context: ProjectContext, options: TemplateOptions = {}): string {
    const {
      includeExamples = true,
      includeVisualFormats = true,
      includeBatchValidation = true,
      includeSwarmPatterns = context.hasSwarm,
      includeMCPTools = context.hasMCP,
      customInstructions = []
    } = options;

    let template = this.generateHeader(context);
    template += '\n\n' + this.generateBatchingRules();
    template += '\n\n' + this.generateTodoWriteSection(context, includeExamples);
    
    if (includeSwarmPatterns) {
      template += '\n\n' + this.generateSwarmPatterns(context);
    }
    
    if (includeMCPTools) {
      template += '\n\n' + this.generateMCPSection(context);
    }
    
    if (includeVisualFormats) {
      template += '\n\n' + this.generateVisualFormats();
    }
    
    if (includeBatchValidation) {
      template += '\n\n' + this.generateBatchValidation();
    }
    
    template += '\n\n' + this.generateProjectSpecific(context);
    template += '\n\n' + this.generateBestPractices(context);
    
    if (customInstructions.length > 0) {
      template += '\n\n' + this.generateCustomInstructions(customInstructions);
    }
    
    return template;
  }

  /**
   * Generate project-specific header
   */
  private static generateHeader(context: ProjectContext): string {
    const projectTypeLabels = {
      'web-app': 'Web Application Development',
      'api': 'API Development',
      'cli': 'CLI Tool Development',
      'library': 'Library Development',
      'data-pipeline': 'Data Pipeline Development',
      'microservice': 'Microservice Development',
      'full-stack': 'Full-Stack Application Development',
      'generic': 'Development Project'
    };

    return `# Claude Code Configuration - ${projectTypeLabels[context.type]}

## 🚨 CRITICAL: MANDATORY BATCHING FOR ALL OPERATIONS

**ABSOLUTE RULE**: ALL operations MUST be concurrent/parallel in a single message:

### 🔴 MANDATORY CONCURRENT PATTERNS:
1. **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
2. **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
3. **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
4. **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
5. **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**If you need to do X operations, they should be in 1 message, not X messages.**`;
  }

  /**
   * Generate core batching rules
   */
  private static generateBatchingRules(): string {
    return `## 📦 MANDATORY BATCHING RULES

### ✅ CORRECT - Everything in ONE Message:
\`\`\`javascript
[Single Message]:
  - TodoWrite { todos: [10+ todos with all statuses/priorities] }
  - Task("Agent 1 with full instructions and coordination")
  - Task("Agent 2 with full instructions and coordination")
  - Task("Agent 3 with full instructions and coordination")
  - Read("file1.js")
  - Read("file2.js")
  - Read("file3.js")
  - Write("output1.js", content)
  - Write("output2.js", content)
  - Bash("npm install")
  - Bash("npm test")
  - Bash("npm run build")
\`\`\`

### ❌ WRONG - Multiple Messages (NEVER DO THIS):
\`\`\`javascript
Message 1: TodoWrite { todos: [single todo] }
Message 2: Task("Agent 1")
Message 3: Task("Agent 2")
Message 4: Read("file1.js")
Message 5: Write("output1.js")
Message 6: Bash("npm install")
// This is 6x slower and breaks coordination!
\`\`\`

### 🎯 CONCURRENT EXECUTION CHECKLIST:

Before sending ANY message, ask yourself:
- ✅ Are ALL related TodoWrite operations batched together?
- ✅ Are ALL Task spawning operations in ONE message?
- ✅ Are ALL file operations (Read/Write/Edit) batched together?
- ✅ Are ALL bash commands grouped in ONE message?
- ✅ Are ALL memory operations concurrent?

**If ANY answer is "No", you MUST combine operations into a single message!**`;
  }

  /**
   * Generate TodoWrite section with best practices
   */
  private static generateTodoWriteSection(context: ProjectContext, includeExamples: boolean): string {
    let section = `## 📝 TODOWRITE BEST PRACTICES

### 🚨 MANDATORY TODOWRITE RULES:

1. **BATCH SIZE**: ALWAYS include 5-10+ todos in a SINGLE TodoWrite call
2. **STATUS VARIETY**: Include todos with different statuses (pending, in_progress, completed)
3. **PRIORITY DISTRIBUTION**: Mix high, medium, and low priority tasks
4. **DEPENDENCIES**: Use dependency relationships to show task order
5. **AGENT ASSIGNMENT**: Assign todos to specific agents when using swarms
6. **NEVER SEQUENTIAL**: NEVER call TodoWrite multiple times in sequence

### 📋 TodoWrite Structure:
\`\`\`javascript
TodoWrite({
  todos: [
    {
      id: "unique-id",
      content: "Clear, actionable task description",
      status: "pending" | "in_progress" | "completed",
      priority: "high" | "medium" | "low",
      dependencies?: ["other-task-id"],
      assignedAgent?: "agent-name",
      estimatedTime?: "30min",
      tags?: ["category", "type"]
    }
    // ... 5-10+ more todos
  ]
});
\`\`\``;

    if (includeExamples) {
      section += `\n\n### 🎯 Project-Specific TodoWrite Example:

\`\`\`javascript
// ✅ CORRECT ${context.type.toUpperCase()} TodoWrite Pattern
TodoWrite({
  todos: [
${this.generateProjectSpecificTodos(context)}
  ]
});
\`\`\``;
    }

    return section;
  }

  /**
   * Generate project-specific todo examples
   */
  private static generateProjectSpecificTodos(context: ProjectContext): string {
    const todoTemplates = {
      'web-app': [
        '    { id: "setup", content: "Initialize React/Vue project structure", status: "completed", priority: "high" }',
        '    { id: "components", content: "Create reusable UI components", status: "in_progress", priority: "high" }',
        '    { id: "routing", content: "Implement client-side routing", status: "pending", priority: "medium", dependencies: ["components"] }',
        '    { id: "state", content: "Set up state management", status: "pending", priority: "high", dependencies: ["components"] }',
        '    { id: "api", content: "Integrate with backend API", status: "pending", priority: "high", dependencies: ["state"] }',
        '    { id: "testing", content: "Write component tests", status: "pending", priority: "medium", dependencies: ["components"] }',
        '    { id: "styling", content: "Implement responsive design", status: "pending", priority: "medium" }',
        '    { id: "build", content: "Configure build pipeline", status: "pending", priority: "low" }'
      ],
      'api': [
        '    { id: "setup", content: "Initialize API project structure", status: "completed", priority: "high" }',
        '    { id: "auth", content: "Implement authentication middleware", status: "in_progress", priority: "high" }',
        '    { id: "endpoints", content: "Create REST/GraphQL endpoints", status: "pending", priority: "high", dependencies: ["auth"] }',
        '    { id: "validation", content: "Add input validation", status: "pending", priority: "high", dependencies: ["endpoints"] }',
        '    { id: "database", content: "Set up database models", status: "pending", priority: "high" }',
        '    { id: "testing", content: "Write API tests", status: "pending", priority: "medium", dependencies: ["endpoints"] }',
        '    { id: "docs", content: "Generate API documentation", status: "pending", priority: "medium", dependencies: ["endpoints"] }',
        '    { id: "deploy", content: "Configure deployment", status: "pending", priority: "low" }'
      ],
      'cli': [
        '    { id: "setup", content: "Initialize CLI project structure", status: "completed", priority: "high" }',
        '    { id: "commands", content: "Define command structure", status: "in_progress", priority: "high" }',
        '    { id: "parsing", content: "Implement argument parsing", status: "pending", priority: "high", dependencies: ["commands"] }',
        '    { id: "actions", content: "Implement command actions", status: "pending", priority: "high", dependencies: ["parsing"] }',
        '    { id: "config", content: "Add configuration system", status: "pending", priority: "medium" }',
        '    { id: "testing", content: "Write CLI tests", status: "pending", priority: "medium", dependencies: ["actions"] }',
        '    { id: "docs", content: "Create usage documentation", status: "pending", priority: "medium" }',
        '    { id: "package", content: "Configure packaging", status: "pending", priority: "low" }'
      ],
      'data-pipeline': [
        '    { id: "setup", content: "Initialize pipeline architecture", status: "completed", priority: "high" }',
        '    { id: "ingestion", content: "Implement data ingestion", status: "in_progress", priority: "high" }',
        '    { id: "validation", content: "Add data validation", status: "pending", priority: "high", dependencies: ["ingestion"] }',
        '    { id: "transform", content: "Create transformation logic", status: "pending", priority: "high", dependencies: ["validation"] }',
        '    { id: "storage", content: "Set up data storage", status: "pending", priority: "high" }',
        '    { id: "monitoring", content: "Add pipeline monitoring", status: "pending", priority: "medium", dependencies: ["transform"] }',
        '    { id: "alerting", content: "Configure error alerting", status: "pending", priority: "medium", dependencies: ["monitoring"] }',
        '    { id: "scaling", content: "Implement auto-scaling", status: "pending", priority: "low" }'
      ]
    };

    return (todoTemplates[context.type as keyof typeof todoTemplates] || todoTemplates['api']).join(',\n');
  }

  /**
   * Generate swarm coordination patterns
   */
  private static generateSwarmPatterns(context: ProjectContext): string {
    return `## 🐝 SWARM COORDINATION PATTERNS

### 🚨 MANDATORY SWARM BATCHING:

When using swarms, ALL initialization must be in ONE message:

\`\`\`javascript
// ✅ CORRECT - Complete Swarm Initialization
[Single Message]:
  // MCP coordination setup
  mcp__flowx__swarm_init { topology: "hierarchical", maxAgents: ${context.agentCount || 6} }
  ${this.generateSwarmAgentSpawns(context)}
  
  // TodoWrite with comprehensive task breakdown
  TodoWrite { todos: [
    // 8-12 todos covering all aspects of ${context.type}
    { id: "architecture", content: "Design system architecture", status: "in_progress", priority: "high" },
    { id: "implementation", content: "Implement core features", status: "pending", priority: "high", dependencies: ["architecture"] },
    { id: "integration", content: "Integrate components", status: "pending", priority: "high", dependencies: ["implementation"] },
    { id: "testing", content: "Comprehensive testing", status: "pending", priority: "medium", dependencies: ["integration"] },
    { id: "deployment", content: "Deploy to production", status: "pending", priority: "medium", dependencies: ["testing"] }
    // ... more todos
  ]}
  
  // Initial memory coordination
  mcp__flowx__memory_store { key: "project/context", value: ${JSON.stringify(context)} }
  mcp__flowx__task_orchestrate { strategy: "parallel" }
\`\`\`

### 🎛️ COORDINATION MODES:

- **Centralized**: Single coordinator for ${context.complexity} projects
- **Hierarchical**: Team leads for ${context.type} development
- **Distributed**: Parallel execution for complex features
- **Mesh**: Peer-to-peer for adaptive requirements`;
  }

  /**
   * Generate swarm agent spawns based on project context
   */
  private static generateSwarmAgentSpawns(context: ProjectContext): string {
    const agentTemplates = {
      'web-app': [
        'mcp__flowx__agent_spawn { type: "architect", name: "Frontend Architect" }',
        'mcp__flowx__agent_spawn { type: "coder", name: "React/Vue Developer" }',
        'mcp__flowx__agent_spawn { type: "coder", name: "CSS/UI Developer" }',
        'mcp__flowx__agent_spawn { type: "tester", name: "Frontend Tester" }',
        'mcp__flowx__agent_spawn { type: "coordinator", name: "Project Manager" }'
      ],
      'api': [
        'mcp__flowx__agent_spawn { type: "architect", name: "API Architect" }',
        'mcp__flowx__agent_spawn { type: "coder", name: "Backend Developer" }',
        'mcp__flowx__agent_spawn { type: "analyst", name: "Database Designer" }',
        'mcp__flowx__agent_spawn { type: "tester", name: "API Tester" }',
        'mcp__flowx__agent_spawn { type: "coordinator", name: "Tech Lead" }'
      ],
      'data-pipeline': [
        'mcp__flowx__agent_spawn { type: "architect", name: "Data Architect" }',
        'mcp__flowx__agent_spawn { type: "coder", name: "Pipeline Developer" }',
        'mcp__flowx__agent_spawn { type: "analyst", name: "Data Analyst" }',
        'mcp__flowx__agent_spawn { type: "researcher", name: "ML Engineer" }',
        'mcp__flowx__agent_spawn { type: "coordinator", name: "Data Lead" }'
      ]
    };

    const agents = agentTemplates[context.type as keyof typeof agentTemplates] || agentTemplates['api'];
    return agents.map((agent: string) => `  ${agent}`).join('\n');
  }

  /**
   * Generate MCP tools section
   */
  private static generateMCPSection(context: ProjectContext): string {
    return `## 🔧 MCP TOOLS INTEGRATION

### Available MCP Tools:
- **mcp__flowx__swarm_init**: Initialize swarm coordination
- **mcp__flowx__agent_spawn**: Spawn specialized agents
- **mcp__flowx__task_orchestrate**: Coordinate task execution
- **mcp__flowx__memory_store**: Store coordination data
- **mcp__flowx__memory_retrieve**: Retrieve shared knowledge
- **mcp__flowx__swarm_monitor**: Monitor swarm progress

### 🎯 MCP Coordination Pattern:
1. **Planning Phase**: Use MCP tools to set up coordination
2. **Execution Phase**: Use Claude Code tools for actual work
3. **Monitoring Phase**: Use MCP tools to track progress

**REMEMBER**: MCP tools coordinate, Claude Code executes!`;
  }

  /**
   * Generate visual formats section
   */
  private static generateVisualFormats(): string {
    return `## 📊 VISUAL PROGRESS FORMATS

### Standard Progress Display:
\`\`\`
📊 Progress Overview
   ├── Total Tasks: 12
   ├── ✅ Completed: 8 (67%)
   ├── 🔄 In Progress: 2 (17%)
   ├── ⭕ Todo: 1 (8%)
   └── ❌ Blocked: 1 (8%)

⭕ Pending (1)
   └── 🔴 001: Critical task description [HIGH] ▶

🔄 In Progress (2)
   ├── 🟡 002: Medium priority task ↳ 1 deps
   └── 🔴 003: High priority task [HIGH] ▶

✅ Completed (8)
   ├── ✅ 004: Completed task
   └── ... (more completed tasks)
\`\`\`

### Priority Indicators:
- 🔴 **HIGH**: Critical/urgent tasks
- 🟡 **MEDIUM**: Important tasks
- 🟢 **LOW**: Deferred tasks

### Status Icons:
- ✅ **COMPLETED**: Finished tasks
- 🔄 **IN PROGRESS**: Active work
- ⭕ **PENDING**: Ready to start
- ❌ **BLOCKED**: Waiting on dependencies

### Special Notations:
- \`↳ X deps\`: Task has X dependencies
- \`▶\`: Actionable (no blocking dependencies)
- \`[HIGH]\`: Priority indicator for important tasks`;
  }

  /**
   * Generate batch validation rules
   */
  private static generateBatchValidation(): string {
    return `## ⚡ BATCH VALIDATION ENFORCEMENT

### Validation Checklist:
- [ ] TodoWrite contains 5+ todos minimum
- [ ] All related operations in single message
- [ ] No sequential task spawning
- [ ] No individual file operations when batch possible
- [ ] Memory operations grouped together

### Automatic Validation:
The system will enforce these rules and warn about violations:

\`\`\`
⚠️  BATCH VIOLATION DETECTED:
   └── TodoWrite called with only 2 todos (minimum: 5)
   └── Recommendation: Combine with related tasks

⚠️  SEQUENTIAL PATTERN DETECTED:
   └── Multiple messages for related operations
   └── Recommendation: Use single message with parallel tools
\`\`\`

### Performance Impact:
- **Parallel Execution**: 3-6x faster than sequential
- **Reduced Latency**: Single round-trip vs multiple
- **Better Coordination**: Atomic operations prevent conflicts`;
  }

  /**
   * Generate project-specific optimizations
   */
  private static generateProjectSpecific(context: ProjectContext): string {
    const optimizations = {
      'web-app': `## 🎨 WEB APPLICATION OPTIMIZATIONS

### Frontend-Specific Batching:
- Batch component file creation (Read/Write multiple .tsx/.vue files)
- Parallel styling operations (CSS/SCSS files)
- Combined asset optimization (images, fonts, icons)
- Batch test file generation for component suites

### State Management TodoWrite Pattern:
\`\`\`javascript
TodoWrite({
  todos: [
    { id: "store", content: "Set up global store", status: "pending", priority: "high" },
    { id: "actions", content: "Define action creators", status: "pending", priority: "high", dependencies: ["store"] },
    { id: "reducers", content: "Implement reducers", status: "pending", priority: "high", dependencies: ["actions"] },
    { id: "middleware", content: "Add middleware", status: "pending", priority: "medium", dependencies: ["reducers"] },
    { id: "persistence", content: "Add state persistence", status: "pending", priority: "low", dependencies: ["middleware"] }
  ]
});
\`\`\``,
      'api': `## 🔌 API DEVELOPMENT OPTIMIZATIONS

### Backend-Specific Batching:
- Batch endpoint creation (multiple route files)
- Parallel middleware implementation
- Combined database operations (models, migrations, seeds)
- Batch test file generation for API endpoints

### API Development TodoWrite Pattern:
\`\`\`javascript
TodoWrite({
  todos: [
    { id: "auth", content: "Implement authentication", status: "in_progress", priority: "high" },
    { id: "users", content: "Create user endpoints", status: "pending", priority: "high", dependencies: ["auth"] },
    { id: "validation", content: "Add input validation", status: "pending", priority: "high", dependencies: ["users"] },
    { id: "middleware", content: "Create custom middleware", status: "pending", priority: "medium" },
    { id: "testing", content: "Write API tests", status: "pending", priority: "medium", dependencies: ["validation"] },
    { id: "docs", content: "Generate OpenAPI docs", status: "pending", priority: "low", dependencies: ["testing"] }
  ]
});
\`\`\``,
      'data-pipeline': `## 📊 DATA PIPELINE OPTIMIZATIONS

### Pipeline-Specific Batching:
- Batch data source connections
- Parallel transformation implementations
- Combined monitoring and alerting setup
- Batch test data generation

### Pipeline TodoWrite Pattern:
\`\`\`javascript
TodoWrite({
  todos: [
    { id: "ingestion", content: "Set up data ingestion", status: "in_progress", priority: "high" },
    { id: "validation", content: "Implement data validation", status: "pending", priority: "high", dependencies: ["ingestion"] },
    { id: "transform", content: "Create transformation jobs", status: "pending", priority: "high", dependencies: ["validation"] },
    { id: "storage", content: "Configure data warehouse", status: "pending", priority: "high" },
    { id: "monitoring", content: "Add pipeline monitoring", status: "pending", priority: "medium", dependencies: ["transform"] },
    { id: "alerting", content: "Set up error alerts", status: "pending", priority: "medium", dependencies: ["monitoring"] }
  ]
});
\`\`\``
    };

    return optimizations[context.type as keyof typeof optimizations] || optimizations['api'];
  }

  /**
   * Generate best practices section
   */
  private static generateBestPractices(context: ProjectContext): string {
    return `## 🎯 BEST PRACTICES SUMMARY

### 1. Always Batch Operations
- Use single messages for related operations
- Minimize round-trips for better performance
- Group by operation type when possible

### 2. TodoWrite Excellence
- Include 5-10+ todos per call
- Mix priorities and statuses
- Use clear, actionable descriptions
- Set up proper dependencies

### 3. Agent Coordination
- Spawn all agents in one message
- Include full task instructions
- Use memory for coordination
- Monitor progress collectively

### 4. File Operations
- Batch reads/writes when analyzing codebases
- Use parallel operations for independent files
- Combine related file modifications

### 5. Memory Management
- Store coordination data early
- Use namespaced keys for organization
- Retrieve related data together
- Clean up unused entries

### 6. Error Handling
- Plan for failure scenarios in todos
- Include rollback procedures
- Set up monitoring and alerts
- Document recovery processes

### 🚀 Remember: Efficiency through intelligent batching!`;
  }

  /**
   * Generate custom instructions section
   */
  private static generateCustomInstructions(instructions: string[]): string {
    let section = `## 🎯 PROJECT-SPECIFIC INSTRUCTIONS

`;
    
    instructions.forEach((instruction, index) => {
      section += `### ${index + 1}. ${instruction}\n\n`;
    });
    
    return section;
  }

  /**
   * Quick template generators for common project types
   */
  static generateWebAppTemplate(options: TemplateOptions = {}): string {
    return this.generateTemplate({
      type: 'web-app',
      hasSwarm: true,
      hasMCP: true,
      hasMemory: true,
      agentCount: 5,
      complexity: 'medium',
      frameworks: ['React', 'Vue'],
      useSPARC: true
    }, options);
  }

  static generateAPITemplate(options: TemplateOptions = {}): string {
    return this.generateTemplate({
      type: 'api',
      hasSwarm: true,
      hasMCP: true,
      hasMemory: true,
      agentCount: 4,
      complexity: 'medium',
      frameworks: ['Express', 'FastAPI'],
      useSPARC: true
    }, options);
  }

  static generateDataPipelineTemplate(options: TemplateOptions = {}): string {
    return this.generateTemplate({
      type: 'data-pipeline',
      hasSwarm: true,
      hasMCP: true,
      hasMemory: true,
      agentCount: 6,
      complexity: 'complex',
      frameworks: ['Apache Airflow', 'Spark'],
      useSPARC: true
    }, options);
  }
} 