/**
 * Workflow Command
 * Comprehensive workflow management and orchestration
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.ts';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.ts';
import { getMemoryManager, getPersistenceManager } from '../../core/global-initialization.ts';
import { nanoid } from 'nanoid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskEngine, WorkflowTask, Workflow as TaskWorkflow } from '../../../task/engine.ts';
import { SwarmCoordinator } from '../../../swarm/coordinator.ts';

// Dynamic import for YAML support
type YAMLModule = {
  load: (content: string) => any;
  dump: (obj: any) => string;
};

interface WorkflowStep {
  id: string;
  name: string;
  type: 'task' | 'condition' | 'parallel' | 'sequential';
  command?: string;
  agentType?: string;
  dependencies: string[];
  timeout?: number;
  retryCount?: number;
  onSuccess?: string;
  onFailure?: string;
  metadata: Record<string, any>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  steps: WorkflowStep[];
  variables: Record<string, any>;
  triggers: string[];
  schedule?: string;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  metadata: Record<string, any>;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  logs: string[];
  results: Record<string, any>;
}

export const workflowCommand: CLICommand = {
  name: 'workflow',
  description: 'Manage and execute workflows with real orchestration',
  category: 'Workflow',
  usage: 'flowx workflow <subcommand> [OPTIONS]',
  examples: [
    'flowx workflow create --name "CI/CD Pipeline" --file pipeline.tson',
    'flowx workflow list --status active',
    'flowx workflow run workflow-123',
    'flowx workflow status execution-456',
    'flowx workflow template create basic-pipeline'
  ],
  subcommands: [
    {
      name: 'create',
      description: 'Create a new workflow',
      handler: async (context: CLIContext) => await createWorkflow(context),
      options: [
        {
          name: 'name',
          short: 'n',
          description: 'Workflow name',
          type: 'string',
          required: true
        },
        {
          name: 'description',
          short: 'd',
          description: 'Workflow description',
          type: 'string'
        },
        {
          name: 'file',
          short: 'f',
          description: 'Workflow definition file (JSON/YAML)',
          type: 'string'
        },
        {
          name: 'template',
          short: 't',
          description: 'Use workflow template',
          type: 'string'
        }
      ]
    },
    {
      name: 'list',
      description: 'List workflows',
      handler: async (context: CLIContext) => await listWorkflows(context),
      options: [
        {
          name: 'status',
          short: 's',
          description: 'Filter by status',
          type: 'string',
          choices: ['draft', 'active', 'paused', 'completed', 'failed']
        },
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum workflows to show',
          type: 'number',
          default: 20
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        }
      ]
    },
    {
      name: 'show',
      description: 'Show workflow details',
      handler: async (context: CLIContext) => await showWorkflow(context)
    },
    {
      name: 'run',
      description: 'Execute workflow',
      handler: async (context: CLIContext) => await runWorkflow(context),
      options: [
        {
          name: 'variables',
          short: 'v',
          description: 'Workflow variables (JSON)',
          type: 'string'
        },
        {
          name: 'async',
          short: 'a',
          description: 'Run asynchronously',
          type: 'boolean'
        },
        {
          name: 'timeout',
          short: 't',
          description: 'Execution timeout in seconds',
          type: 'number'
        }
      ]
    },
    {
      name: 'status',
      description: 'Check execution status',
      handler: async (context: CLIContext) => await checkExecutionStatus(context)
    },
    {
      name: 'stop',
      description: 'Stop workflow execution',
      handler: async (context: CLIContext) => await stopExecution(context),
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force stop execution',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'logs',
      description: 'Show execution logs',
      handler: async (context: CLIContext) => await showExecutionLogs(context),
      options: [
        {
          name: 'follow',
          short: 'f',
          description: 'Follow logs in real-time',
          type: 'boolean'
        },
        {
          name: 'lines',
          short: 'n',
          description: 'Number of lines to show',
          type: 'number',
          default: 50
        }
      ]
    },
    {
      name: 'template',
      description: 'Manage workflow templates',
      handler: async (context: CLIContext) => await manageTemplates(context)
    },
    {
      name: 'validate',
      description: 'Validate workflow definition',
      handler: async (context: CLIContext) => await validateWorkflow(context)
    },
    {
      name: 'export',
      description: 'Export workflow definition',
      handler: async (context: CLIContext) => await exportWorkflow(context),
      options: [
        {
          name: 'format',
          short: 'f',
          description: 'Export format',
          type: 'string',
          choices: ['json', 'yaml'],
          default: 'json'
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    return await listWorkflows(context);
  }
};

// Add real execution engine instances
let taskEngine: TaskEngine | null = null;
let swarmCoordinator: SwarmCoordinator | null = null;

async function getTaskEngine(): Promise<TaskEngine> {
  if (!taskEngine) {
    taskEngine = new TaskEngine(10); // max 10 concurrent tasks
    // TaskEngine doesn't have initialize method, constructor sets it up
  }
  return taskEngine;
}

async function getSwarmCoordinator(): Promise<SwarmCoordinator> {
  if (!swarmCoordinator) {
    swarmCoordinator = new SwarmCoordinator({
      maxAgents: 5,
      coordinationStrategy: {
        name: 'hybrid',
        description: 'Hybrid coordination strategy combining multiple approaches',
        agentSelection: 'capability-based',
        taskScheduling: 'priority',
        loadBalancing: 'work-stealing',
        faultTolerance: 'retry',
        communication: 'direct'
      }
    });
    await swarmCoordinator.initialize();
  }
  return swarmCoordinator;
}

// Workflow management functions

async function createWorkflow(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (!options.name) {
    printError('Workflow name is required');
    printInfo('Usage: flowx workflow create --name "Workflow Name" [options]');
    return;
  }

  try {
    let workflowDef: Partial<Workflow> = {};

    // Load from file if specified
    if (options.file) {
      const content = await fs.readFile(options.file, 'utf8');
      if (options.file.endsWith('.tson')) {
        workflowDef = JSON.parse(content);
      } else if (options.file.endsWith('.yml') || options.file.endsWith('.yaml')) {
        // YAML parsing using js-yaml
        try {
          // @ts-ignore - Dynamic import for optional YAML support
          const yaml = await import('js-yaml');
          workflowDef = yaml.load(content);
        } catch (error) {
          if (error instanceof Error && error.message.includes('Cannot resolve module')) {
            throw new Error('YAML support requires js-yaml package. Please install it or use JSON format.');
          }
          throw new Error(`Failed to parse YAML file: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Use template if specified
    if (options.template) {
      workflowDef = await loadWorkflowTemplate(options.template);
    }

    const workflow: Workflow = {
      id: `workflow-${nanoid()}`,
      name: options.name,
      description: options.description || workflowDef.description || '',
      version: '1.0.0',
      status: 'draft',
      steps: workflowDef.steps || [],
      variables: workflowDef.variables || {},
      triggers: workflowDef.triggers || [],
      schedule: workflowDef.schedule,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        source: 'cli',
        createdBy: 'user',
        ...workflowDef.metadata
      }
    };

    // Store workflow
    await storeWorkflow(workflow);

    printSuccess(`✅ Workflow created: ${workflow.id}`);
    printInfo(`Name: ${workflow.name}`);
    printInfo(`Steps: ${workflow.steps.length}`);
    printInfo(`Status: ${workflow.status}`);
    
  } catch (error) {
    printError(`Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function listWorkflows(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    let workflows = await getWorkflows();

    // Apply filters
    if (options.status) {
      workflows = workflows.filter((wf: Workflow) => wf.status === options.status);
    }

    // Apply limit
    if (options.limit) {
      workflows = workflows.slice(0, options.limit);
    }

    if (workflows.length === 0) {
      printInfo('No workflows found matching criteria');
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(workflows, null, 2));
    } else {
      displayWorkflowsTable(workflows, 'Workflows');
    }
    
    printSuccess(`Found ${workflows.length} workflows`);
    
  } catch (error) {
    printError(`Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showWorkflow(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const workflowId = args[0];
  if (!workflowId) {
    printError('Workflow ID is required');
    printInfo('Usage: flowx workflow show <workflow-id>');
    return;
  }

  try {
    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      printError(`Workflow not found: ${workflowId}`);
      return;
    }

    console.log(successBold(`\n🔄 Workflow Details: ${workflow.id}\n`));
    console.log(`Name: ${workflow.name}`);
    console.log(`Description: ${workflow.description || 'No description'}`);
    console.log(`Version: ${workflow.version}`);
    console.log(`Status: ${getStatusDisplay(workflow.status)}`);
    console.log(`Steps: ${workflow.steps.length}`);
    console.log(`Variables: ${Object.keys(workflow.variables).length}`);
    console.log(`Created: ${new Date(workflow.createdAt).toLocaleString()}`);
    console.log(`Updated: ${new Date(workflow.updatedAt).toLocaleString()}`);
    
    if (workflow.lastRunAt) {
      console.log(`Last Run: ${new Date(workflow.lastRunAt).toLocaleString()}`);
    }

    if (workflow.schedule) {
      console.log(`Schedule: ${workflow.schedule}`);
    }

    // Show workflow steps
    if (workflow.steps.length > 0) {
      console.log('\nWorkflow Steps:');
      workflow.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.name} (${step.type})`);
        if (step.dependencies.length > 0) {
          console.log(`     Dependencies: ${step.dependencies.join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    printError(`Failed to show workflow: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runWorkflow(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const workflowId = args[0];
  if (!workflowId) {
    printError('Workflow ID is required');
    printInfo('Usage: flowx workflow run <workflow-id> [options]');
    return;
  }

  try {
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      printError(`Workflow not found: ${workflowId}`);
      return;
    }

    // Parse variables if provided
    let variables = workflow.variables;
    if (options.variables) {
      try {
        const customVars = JSON.parse(options.variables);
        variables = { ...variables, ...customVars };
      } catch (error) {
        printError('Invalid variables JSON format');
        return;
      }
    }

    // Create execution
    const execution: WorkflowExecution = {
      id: `exec-${nanoid()}`,
      workflowId: workflow.id,
      status: 'pending',
      startedAt: Date.now(),
      logs: [],
      results: {}
    };

    await storeExecution(execution);

    printSuccess(`✅ Workflow execution started: ${execution.id}`);
    printInfo(`Workflow: ${workflow.name}`);
    printInfo(`Steps: ${workflow.steps.length}`);

    if (options.async) {
      printInfo('Running asynchronously. Use "flowx workflow status" to check progress.');
      // Start execution in background
      executeWorkflowAsync(workflow, execution, variables, options.timeout);
    } else {
      printInfo('Running synchronously...');
      await executeWorkflow(workflow, execution, variables, options.timeout);
    }
    
  } catch (error) {
    printError(`Failed to run workflow: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function checkExecutionStatus(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const executionId = args[0];
  if (!executionId) {
    printError('Execution ID is required');
    printInfo('Usage: flowx workflow status <execution-id>');
    return;
  }

  try {
    const execution = await getExecution(executionId);
    if (!execution) {
      printError(`Execution not found: ${executionId}`);
      return;
    }

    const workflow = await getWorkflow(execution.workflowId);

    console.log(successBold(`\n📊 Execution Status: ${execution.id}\n`));
    console.log(`Workflow: ${workflow?.name || execution.workflowId}`);
    console.log(`Status: ${getExecutionStatusDisplay(execution.status)}`);
    console.log(`Started: ${new Date(execution.startedAt).toLocaleString()}`);
    
    if (execution.completedAt) {
      const duration = execution.completedAt - execution.startedAt;
      console.log(`Completed: ${new Date(execution.completedAt).toLocaleString()}`);
      console.log(`Duration: ${Math.round(duration / 1000)}s`);
    }

    if (execution.currentStep) {
      console.log(`Current Step: ${execution.currentStep}`);
    }

    if (execution.error) {
      console.log(`Error: ${execution.error}`);
    }

    if (execution.logs.length > 0) {
      console.log('\nRecent Logs:');
      execution.logs.slice(-5).forEach(log => {
        console.log(`  ${log}`);
      });
    }
    
  } catch (error) {
    printError(`Failed to check execution status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function stopExecution(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const executionId = args[0];
  if (!executionId) {
    printError('Execution ID is required');
    printInfo('Usage: flowx workflow stop <execution-id> [--force]');
    return;
  }

  try {
    const execution = await getExecution(executionId);
    if (!execution) {
      printError(`Execution not found: ${executionId}`);
      return;
    }

    if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
      printWarning(`Execution is already ${execution.status}`);
      return;
    }

    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    execution.logs.push(`Execution cancelled at ${new Date().toISOString()}`);

    await storeExecution(execution);

    printSuccess(`✅ Execution stopped: ${executionId}`);
    
  } catch (error) {
    printError(`Failed to stop execution: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showExecutionLogs(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const executionId = args[0];
  if (!executionId) {
    printError('Execution ID is required');
    printInfo('Usage: flowx workflow logs <execution-id> [options]');
    return;
  }

  try {
    const execution = await getExecution(executionId);
    if (!execution) {
      printError(`Execution not found: ${executionId}`);
      return;
    }

    console.log(successBold(`\n📄 Execution Logs: ${execution.id}\n`));

    const logs = execution.logs.slice(-(options.lines || 50));
    if (logs.length === 0) {
      printInfo('No logs available');
      return;
    }

    logs.forEach(log => {
      console.log(log);
    });

    if (options.follow) {
      printInfo('\nFollowing logs (Ctrl+C to stop)...');
      // In a real implementation, this would stream logs in real-time
      printInfo('Real-time log following not implemented in this demo');
    }
    
  } catch (error) {
    printError(`Failed to show execution logs: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function manageTemplates(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const action = args[0];
  
  if (!action) {
    // List templates
    await listTemplates();
    return;
  }

  switch (action) {
    case 'list':
      await listTemplates();
      break;
    case 'create':
      await createTemplate(args[1]);
      break;
    case 'show':
      await showTemplate(args[1]);
      break;
    default:
      printError(`Unknown template action: ${action}`);
      printInfo('Available actions: list, create, show');
  }
}

async function validateWorkflow(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const workflowId = args[0];
  if (!workflowId) {
    printError('Workflow ID is required');
    printInfo('Usage: flowx workflow validate <workflow-id>');
    return;
  }

  try {
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      printError(`Workflow not found: ${workflowId}`);
      return;
    }

    const validation = validateWorkflowDefinition(workflow);

    console.log(successBold(`\n🔍 Workflow Validation: ${workflow.name}\n`));

    if (validation.valid) {
      printSuccess('✅ Workflow is valid');
    } else {
      printError('❌ Workflow validation failed:');
      validation.errors.forEach(error => printError(`  - ${error}`));
    }

    if (validation.warnings.length > 0) {
      printWarning('Warnings:');
      validation.warnings.forEach(warning => printWarning(`  - ${warning}`));
    }
    
  } catch (error) {
    printError(`Failed to validate workflow: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function exportWorkflow(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const workflowId = args[0];
  if (!workflowId) {
    printError('Workflow ID is required');
    printInfo('Usage: flowx workflow export <workflow-id> [options]');
    return;
  }

  try {
    const workflow = await getWorkflow(workflowId);
    if (!workflow) {
      printError(`Workflow not found: ${workflowId}`);
      return;
    }

    const filename = `${workflow.name.replace(/[^a-zA-Z0-9]/g, '-')}-${workflow.id}.${options.format || 'json'}`;
    
    if (options.format === 'yaml') {
      // Simple YAML export - in production use proper YAML library
      printError('YAML export not implemented. Using JSON format.');
    }

    await fs.writeFile(filename, JSON.stringify(workflow, null, 2));

    printSuccess(`✅ Workflow exported to: ${filename}`);
    
  } catch (error) {
    printError(`Failed to export workflow: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

async function storeWorkflow(workflow: Workflow): Promise<void> {
  const memoryManager = await getMemoryManager();
  
  // Fix the store method call - MemoryManager.store only takes one parameter (MemoryEntry)
  const entry = {
    id: `workflow:${workflow.id}`,
    agentId: 'system',
    sessionId: 'workflow-session',
    type: 'artifact' as const,
    content: JSON.stringify(workflow),
    context: {
      namespace: 'workflow',
      operation: 'store',
      workflowId: workflow.id
    },
    timestamp: new Date(),
    tags: [workflow.status, workflow.version],
    version: 1,
    metadata: {
      name: workflow.name,
      status: workflow.status,
      steps: workflow.steps.length
    }
  };
  
  await memoryManager.store(entry);
}

async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const memoryManager = await getMemoryManager();
    // Fix the query method - use correct MemoryQuery interface
    const result = await memoryManager.query({ 
      search: `workflow:${id}`,
      limit: 1
    });
    return result.length > 0 ? JSON.parse(result[0].content) : null;
  } catch {
    return null;
  }
}

async function getWorkflows(): Promise<Workflow[]> {
  try {
    const memoryManager = await getMemoryManager();
    // Fix the query method - use correct MemoryQuery interface  
    const result = await memoryManager.query({ 
      search: 'workflow:',
      limit: 100
    });
    return result.map(entry => JSON.parse(entry.content));
  } catch {
    return [];
  }
}

async function storeExecution(execution: WorkflowExecution): Promise<void> {
  const memoryManager = await getMemoryManager();
  
  // Fix the store method call
  const entry = {
    id: `execution:${execution.id}`,
    agentId: 'system',
    sessionId: 'workflow-session',
    type: 'artifact' as const,
    content: JSON.stringify(execution),
    context: {
      namespace: 'workflow',
      operation: 'store',
      executionId: execution.id
    },
    timestamp: new Date(),
    tags: [execution.status, execution.workflowId],
    version: 1,
    metadata: {
      workflowId: execution.workflowId,
      status: execution.status
    }
  };
  
  await memoryManager.store(entry);
}

async function getExecution(id: string): Promise<WorkflowExecution | null> {
  try {
    const memoryManager = await getMemoryManager();
    // Fix the query method
    const result = await memoryManager.query({ 
      search: `execution:${id}`,
      limit: 1
    });
    return result.length > 0 ? JSON.parse(result[0].content) : null;
  } catch {
    return null;
  }
}

async function executeWorkflow(workflow: Workflow, execution: WorkflowExecution, variables: Record<string, any>, timeout?: number): Promise<void> {
  execution.status = 'running';
  execution.logs.push(`Starting workflow execution at ${new Date().toISOString()}`);
  await storeExecution(execution);

  try {
    const engine = await getTaskEngine();
    const coordinator = await getSwarmCoordinator();
    
    // Convert workflow steps to TaskEngine tasks
    const workflowTasks: WorkflowTask[] = [];
    const stepToTaskMap = new Map<string, string>();
    
    for (const step of workflow.steps) {
      const taskId = `task-${step.id}`;
      stepToTaskMap.set(step.id, taskId);
      
             const workflowTask: WorkflowTask = {
         id: taskId,
         description: step.name,
         type: step.type === 'task' ? 'execution' : step.type,
         priority: workflow.steps.indexOf(step) + 1,
         status: 'pending',
         input: { command: step.command, variables },
         assignedAgent: step.agentType,
        dependencies: step.dependencies.map(depId => ({
          taskId: stepToTaskMap.get(depId) || depId,
          type: 'finish-to-start'
        })),
        resourceRequirements: [],
        tags: [workflow.name, step.type],
        progressPercentage: 0,
        checkpoints: [],
        retryPolicy: {
          maxAttempts: step.retryCount || 3,
          backoffMs: 1000,
          backoffMultiplier: 2
        },
                          timeout: step.timeout || timeout || 300000, // 5 minutes default
         createdAt: new Date(),
         metadata: {
           createdBy: 'workflow-engine',
          workflowId: workflow.id,
          stepId: step.id,
          command: step.command,
          variables: variables,
          ...step.metadata
        }
      };
      
      workflowTasks.push(workflowTask);
    }
    
    // Create TaskEngine workflow
    const taskWorkflow: TaskWorkflow = {
      id: `tw-${workflow.id}`,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      tasks: workflowTasks,
      variables: variables,
      parallelism: {
        maxConcurrent: 5,
        strategy: 'priority-based'
      },
      errorHandling: {
        strategy: 'fail-fast',
        maxRetries: 3
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'workflow-command'
    };
    
    execution.logs.push(`Created TaskEngine workflow with ${workflowTasks.length} tasks`);
    await storeExecution(execution);
    
    // Setup event handlers for progress tracking
    const taskCompletionPromises: Promise<void>[] = [];
    
    engine.on('task:completed', async (data: { taskId: string; result: any }) => {
      const stepId = findStepIdByTaskId(workflow.steps, data.taskId, stepToTaskMap);
      if (stepId) {
        execution.results[stepId] = { 
          status: 'completed', 
          output: data.result,
          completedAt: new Date().toISOString()
        };
        execution.logs.push(`Completed step: ${stepId}`);
        await storeExecution(execution);
      }
    });
    
    engine.on('task:failed', async (data: { taskId: string; error: any }) => {
      const stepId = findStepIdByTaskId(workflow.steps, data.taskId, stepToTaskMap);
      if (stepId) {
        execution.results[stepId] = { 
          status: 'failed', 
          error: data.error,
          failedAt: new Date().toISOString()
        };
        execution.logs.push(`Failed step: ${stepId} - ${data.error}`);
        await storeExecution(execution);
      }
    });
    
    engine.on('task:started', async (data: { taskId: string }) => {
      const stepId = findStepIdByTaskId(workflow.steps, data.taskId, stepToTaskMap);
      if (stepId) {
        execution.currentStep = stepId;
        execution.logs.push(`Started step: ${stepId}`);
        await storeExecution(execution);
      }
    });
    
    // Execute workflow using TaskEngine
    execution.logs.push('Executing workflow with TaskEngine...');
    await storeExecution(execution);
    
    await engine.executeWorkflow(taskWorkflow);
    
    // Wait for all tasks to complete or fail
    const allTasksPromise = new Promise<void>((resolve, reject) => {
      const checkCompletion = () => {
        const allCompleted = workflowTasks.every(task => 
          ['completed', 'failed', 'cancelled'].includes(task.status)
        );
        
        if (allCompleted) {
          const anyFailed = workflowTasks.some(task => task.status === 'failed');
          if (anyFailed) {
            reject(new Error('One or more workflow tasks failed'));
          } else {
            resolve();
          }
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      
      checkCompletion();
    });
    
    // Apply timeout if specified
    if (timeout) {
      await Promise.race([
        allTasksPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Workflow execution timeout')), timeout)
        )
      ]);
    } else {
      await allTasksPromise;
    }
    
    execution.status = 'completed';
    execution.completedAt = Date.now();
    execution.logs.push(`Workflow completed successfully at ${new Date().toISOString()}`);
    
    printSuccess('✅ Workflow execution completed with TaskEngine');
    
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : String(error);
    execution.completedAt = Date.now();
    execution.logs.push(`Workflow failed: ${execution.error}`);
    
    printError('❌ Workflow execution failed');
    throw error;
  }

  await storeExecution(execution);
}

async function executeWorkflowAsync(workflow: Workflow, execution: WorkflowExecution, variables: Record<string, any>, timeout?: number): Promise<void> {
  // Execute workflow in background using real TaskEngine
  setTimeout(async () => {
    try {
      await executeWorkflow(workflow, execution, variables, timeout);
    } catch (error) {
      console.error('Background workflow execution failed:', error);
    }
  }, 100);
}

// Helper function to find step ID by task ID
function findStepIdByTaskId(steps: WorkflowStep[], taskId: string, stepToTaskMap: Map<string, string>): string | null {
  for (const [stepId, mappedTaskId] of stepToTaskMap.entries()) {
    if (mappedTaskId === taskId) {
      return stepId;
    }
  }
  return null;
}

async function loadWorkflowTemplate(templateName: string): Promise<Partial<Workflow>> {
  const templates: Record<string, Partial<Workflow>> = {
    'basic-pipeline': {
      description: 'Basic CI/CD pipeline workflow',
      steps: [
        {
          id: 'checkout',
          name: 'Checkout Code',
          type: 'task',
          command: 'git checkout',
          dependencies: [],
          metadata: {}
        },
        {
          id: 'build',
          name: 'Build Application',
          type: 'task',
          command: 'npm run build',
          dependencies: ['checkout'],
          metadata: {}
        },
        {
          id: 'test',
          name: 'Run Tests',
          type: 'task',
          command: 'npm test',
          dependencies: ['build'],
          metadata: {}
        }
      ],
      variables: {
        branch: 'main',
        environment: 'production'
      }
    }
  };

  return templates[templateName] || {};
}

async function listTemplates(): Promise<void> {
  const templates = ['basic-pipeline'];
  
  console.log(successBold('\n📋 Available Workflow Templates\n'));
  templates.forEach(template => {
    console.log(`  • ${template}`);
  });
  console.log();
}

async function createTemplate(templateName: string): Promise<void> {
  printInfo(`Creating template: ${templateName}`);
  printInfo('Template creation not implemented in this demo');
}

async function showTemplate(templateName: string): Promise<void> {
  if (!templateName) {
    printError('Template name is required');
    return;
  }

  const template = await loadWorkflowTemplate(templateName);
  if (Object.keys(template).length === 0) {
    printError(`Template not found: ${templateName}`);
    return;
  }

  console.log(successBold(`\n📄 Template: ${templateName}\n`));
  console.log(JSON.stringify(template, null, 2));
}

function validateWorkflowDefinition(workflow: Workflow): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!workflow.name) errors.push('Workflow name is required');
  if (!workflow.steps || workflow.steps.length === 0) errors.push('Workflow must have at least one step');

  // Step validation
  const stepIds = new Set<string>();
  for (const step of workflow.steps) {
    if (!step.id) errors.push('Step ID is required');
    if (!step.name) errors.push('Step name is required');
    if (!step.type) errors.push('Step type is required');
    
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);

    // Check dependencies
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep)) {
        warnings.push(`Step ${step.id} depends on unknown step: ${dep}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function displayWorkflowsTable(workflows: Workflow[], title: string): void {
  console.log(successBold(`\n🔄 ${title}\n`));
  
  const tableData = workflows.map((workflow: Workflow) => ({
    id: workflow.id,
    name: workflow.name.length > 30 ? workflow.name.substring(0, 27) + '...' : workflow.name,
    status: getStatusDisplay(workflow.status),
    steps: workflow.steps.length,
    version: workflow.version,
    created: new Date(workflow.createdAt).toLocaleDateString()
  }));

  console.log(formatTable(tableData, [
    { header: 'ID', key: 'id' },
    { header: 'Name', key: 'name' },
    { header: 'Status', key: 'status' },
    { header: 'Steps', key: 'steps' },
    { header: 'Version', key: 'version' },
    { header: 'Created', key: 'created' }
  ]));
  console.log();
}

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    draft: '📝 Draft',
    active: '🟢 Active',
    paused: '⏸️ Paused',
    completed: '✅ Completed',
    failed: '❌ Failed'
  };
  return statusMap[status] || status;
}

function getExecutionStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '⏳ Pending',
    running: '🔄 Running',
    completed: '✅ Completed',
    failed: '❌ Failed',
    cancelled: '⏹️ Cancelled'
  };
  return statusMap[status] || status;
}

export default workflowCommand; 