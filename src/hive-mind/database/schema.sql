-- Hive Mind SQLite Database Schema
-- Collective intelligence and swarm coordination
-- Based on original flowx v2.0.0 architecture

-- Enable foreign keys and performance optimizations
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- Swarms table: Core swarm configurations
CREATE TABLE IF NOT EXISTS swarms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    topology TEXT NOT NULL CHECK (topology IN ('mesh', 'hierarchical', 'ring', 'star')),
    queen_mode TEXT NOT NULL CHECK (queen_mode IN ('centralized', 'distributed')),
    max_agents INTEGER NOT NULL DEFAULT 8,
    consensus_threshold REAL NOT NULL DEFAULT 0.66,
    memory_ttl INTEGER NOT NULL DEFAULT 86400,
    config TEXT NOT NULL, -- JSON configuration
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    performance_metrics TEXT DEFAULT '{}', -- JSON performance data
    resource_limits TEXT DEFAULT '{}', -- JSON resource constraints
    security_config TEXT DEFAULT '{}' -- JSON security settings
);

-- Agents table: Individual agents in swarms
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'queen', 'coordinator', 'researcher', 'coder', 'analyst', 'architect',
        'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist',
        'security', 'devops'
    )),
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'active', 'error', 'offline')),
    capabilities TEXT NOT NULL, -- JSON array of capabilities
    current_task_id TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    health_score REAL DEFAULT 1.0,
    performance_rating REAL DEFAULT 1.0,
    specialization TEXT,
    system_prompt TEXT,
    resource_usage TEXT DEFAULT '{}', -- JSON resource usage
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Tasks table: Tasks submitted to swarm
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    strategy TEXT NOT NULL DEFAULT 'adaptive' CHECK (strategy IN ('parallel', 'sequential', 'adaptive', 'consensus')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    result TEXT, -- JSON result data
    error TEXT,
    dependencies TEXT DEFAULT '[]', -- JSON array of task IDs
    assigned_agents TEXT DEFAULT '[]', -- JSON array of agent IDs
    require_consensus BOOLEAN NOT NULL DEFAULT 0,
    consensus_achieved BOOLEAN,
    max_agents INTEGER NOT NULL DEFAULT 3,
    required_capabilities TEXT DEFAULT '[]', -- JSON array
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    deadline TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    execution_plan TEXT DEFAULT '{}', -- JSON execution plan
    quality_score REAL DEFAULT 0.0,
    resource_requirements TEXT DEFAULT '{}', -- JSON resource requirements
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Memory table: Persistent collective memory
CREATE TABLE IF NOT EXISTS memory (
    key TEXT NOT NULL,
    namespace TEXT NOT NULL DEFAULT 'default',
    value TEXT NOT NULL, -- JSON or plain text
    ttl INTEGER, -- Time to live in seconds
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    tags TEXT DEFAULT '[]', -- JSON array of tags
    content_type TEXT DEFAULT 'text',
    content_hash TEXT, -- SHA256 hash for deduplication
    importance_score REAL DEFAULT 0.0,
    PRIMARY KEY (key, namespace)
);

-- Communications table: Inter-agent messaging
CREATE TABLE IF NOT EXISTS communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT,
    swarm_id TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('direct', 'broadcast', 'consensus', 'query', 'response', 'notification', 'task_assignment', 'progress_update', 'coordination', 'channel')),
    content TEXT NOT NULL, -- JSON message content
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    requires_response BOOLEAN NOT NULL DEFAULT 0,
    response_to_id INTEGER,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    channel_name TEXT,
    encryption_key TEXT, -- For secure communications
    FOREIGN KEY (from_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (to_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (response_to_id) REFERENCES communications(id) ON DELETE SET NULL
);

-- Consensus table: Consensus decision tracking
CREATE TABLE IF NOT EXISTS consensus (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    task_id TEXT,
    proposal TEXT NOT NULL, -- JSON proposal
    required_threshold REAL NOT NULL,
    current_votes INTEGER NOT NULL DEFAULT 0,
    total_voters INTEGER NOT NULL DEFAULT 0,
    votes TEXT NOT NULL DEFAULT '{}', -- JSON object: {agent_id: {vote: boolean, reason: string, timestamp: string}}
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'achieved', 'failed', 'timeout')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deadline_at TIMESTAMP,
    completed_at TIMESTAMP,
    final_decision TEXT, -- JSON final decision
    confidence_score REAL DEFAULT 0.0,
    voting_strategy TEXT DEFAULT 'simple_majority',
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swarm_id TEXT NOT NULL,
    agent_id TEXT,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    category TEXT DEFAULT 'general',
    unit TEXT DEFAULT 'count',
    aggregation_period TEXT DEFAULT 'instant',
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Neural patterns table: Learned patterns and behaviors
CREATE TABLE IF NOT EXISTS neural_patterns (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('coordination', 'optimization', 'prediction', 'behavior')),
    pattern_data TEXT NOT NULL, -- JSON encoded pattern
    confidence REAL NOT NULL DEFAULT 0.0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    training_data TEXT DEFAULT '{}', -- JSON training data
    model_version TEXT DEFAULT '1.0',
    validation_score REAL DEFAULT 0.0,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Session history table: Track swarm sessions
CREATE TABLE IF NOT EXISTS session_history (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL DEFAULT 0,
    avg_task_duration REAL,
    session_data TEXT DEFAULT '{}', -- JSON session summary
    user_id TEXT,
    session_type TEXT DEFAULT 'interactive',
    outcome TEXT DEFAULT 'unknown',
    quality_rating REAL DEFAULT 0.0,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Hooks table: Hook system configuration and execution
CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    hook_type TEXT NOT NULL CHECK (hook_type IN ('pre-task', 'post-task', 'pre-edit', 'post-edit', 'pre-command', 'post-command', 'session-start', 'session-end', 'session-restore', 'notification')),
    hook_name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT DEFAULT '[]', -- JSON array of arguments
    enabled BOOLEAN NOT NULL DEFAULT 1,
    always_run BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP,
    execution_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Workflows table: Workflow definitions and execution
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    definition TEXT NOT NULL, -- JSON workflow definition
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP,
    execution_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Security events table: Security monitoring and audit trail
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swarm_id TEXT NOT NULL,
    agent_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    description TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_ip TEXT,
    user_agent TEXT,
    metadata TEXT DEFAULT '{}', -- JSON metadata
    resolved BOOLEAN NOT NULL DEFAULT 0,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_agents_swarm ON agents(swarm_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_tasks_swarm ON tasks(swarm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory(namespace);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON memory(tags);
CREATE INDEX IF NOT EXISTS idx_communications_swarm ON communications(swarm_id);
CREATE INDEX IF NOT EXISTS idx_communications_timestamp ON communications(timestamp);
CREATE INDEX IF NOT EXISTS idx_communications_from ON communications(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_communications_to ON communications(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_consensus_swarm ON consensus(swarm_id);
CREATE INDEX IF NOT EXISTS idx_consensus_status ON consensus(status);
CREATE INDEX IF NOT EXISTS idx_metrics_swarm ON performance_metrics(swarm_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_patterns_swarm ON neural_patterns(swarm_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON neural_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_hooks_swarm ON hooks(swarm_id);
CREATE INDEX IF NOT EXISTS idx_hooks_type ON hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_workflows_swarm ON workflows(swarm_id);
CREATE INDEX IF NOT EXISTS idx_security_events_swarm ON security_events(swarm_id);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_swarms_timestamp 
AFTER UPDATE ON swarms
BEGIN
    UPDATE swarms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_workflows_timestamp 
AFTER UPDATE ON workflows
BEGIN
    UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for memory TTL expiration
CREATE TRIGGER IF NOT EXISTS set_memory_expiry
AFTER INSERT ON memory
WHEN NEW.ttl IS NOT NULL
BEGIN
    UPDATE memory 
    SET expires_at = datetime(CURRENT_TIMESTAMP, '+' || NEW.ttl || ' seconds')
    WHERE key = NEW.key AND namespace = NEW.namespace;
END;

-- Trigger for agent activity tracking
CREATE TRIGGER IF NOT EXISTS update_agent_activity
AFTER UPDATE ON agents
WHEN NEW.status != OLD.status
BEGIN
    UPDATE agents 
    SET last_active_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Trigger for task progress tracking
CREATE TRIGGER IF NOT EXISTS track_task_progress
AFTER UPDATE ON tasks
WHEN NEW.status != OLD.status
BEGIN
    UPDATE tasks 
    SET 
        assigned_at = CASE WHEN NEW.status = 'assigned' AND OLD.status = 'pending' THEN CURRENT_TIMESTAMP ELSE OLD.assigned_at END,
        started_at = CASE WHEN NEW.status = 'in_progress' AND OLD.status = 'assigned' THEN CURRENT_TIMESTAMP ELSE OLD.started_at END,
        completed_at = CASE WHEN NEW.status IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE OLD.completed_at END
    WHERE id = NEW.id;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_swarms AS
SELECT s.*, 
       COUNT(DISTINCT a.id) as agent_count,
       COUNT(DISTINCT t.id) as task_count,
       COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks
FROM swarms s
LEFT JOIN agents a ON s.id = a.swarm_id
LEFT JOIN tasks t ON s.id = t.swarm_id
WHERE s.status = 'active'
GROUP BY s.id;

CREATE VIEW IF NOT EXISTS agent_workload AS
SELECT a.id, a.name, a.type, a.swarm_id,
       COUNT(t.id) as active_tasks,
       AVG(CASE WHEN t.status = 'completed' THEN t.quality_score END) as avg_quality,
       a.performance_rating,
       a.health_score
FROM agents a
LEFT JOIN tasks t ON a.id IN (
    SELECT json_each.value 
    FROM json_each(t.assigned_agents)
) AND t.status IN ('assigned', 'in_progress')
GROUP BY a.id;

CREATE VIEW IF NOT EXISTS task_overview AS
SELECT t.id, t.description, t.status, t.priority, t.progress,
       s.name as swarm_name,
       COUNT(DISTINCT json_each.value) as assigned_agent_count,
       t.created_at, t.deadline,
       CASE 
           WHEN t.deadline IS NOT NULL AND t.deadline < CURRENT_TIMESTAMP THEN 'overdue'
           WHEN t.deadline IS NOT NULL AND datetime(t.deadline, '-1 day') < CURRENT_TIMESTAMP THEN 'due_soon'
           ELSE 'on_track'
       END as deadline_status
FROM tasks t
JOIN swarms s ON t.swarm_id = s.id
LEFT JOIN json_each(t.assigned_agents) ON 1=1
GROUP BY t.id;

-- Initialize system metadata
INSERT OR IGNORE INTO memory (key, namespace, value, content_type) VALUES 
('schema_version', 'system', '2.0.0', 'text'),
('initialized_at', 'system', datetime('now'), 'text'),
('features_enabled', 'system', '["hive_mind", "neural_patterns", "consensus", "hooks", "workflows", "security"]', 'json'); 