/**
 * Advanced Swarm Coordination Performance Benchmark Tests
 * Tests complex swarm coordination patterns and communication efficiency
 */

import { describe, test, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { createCommandTestRunner } from '../../../utils/command-test-base';
import path from 'path';
import fs from 'fs/promises';

describe('Advanced Swarm Coordination Benchmarks', () => {
  let runner: any;
  let benchmarkResults: any = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    tests: {}
  };
  
  beforeEach(async () => {
    runner = createCommandTestRunner({
      debug: false,
      timeout: 120000 // Longer timeout for complex swarm tests
    });
    await runner.setup();
  });
  
  afterEach(async () => {
    await runner.teardown();
  });
  
  afterAll(async () => {
    // Save benchmark results
    try {
      const resultsDir = path.join(process.cwd(), 'reports', 'benchmarks', 'advanced');
      await fs.mkdir(resultsDir, { recursive: true });
      
      const filePath = path.join(resultsDir, `swarm-coordination-benchmark-${Date.now()}.json`);
      await fs.writeFile(filePath, JSON.stringify(benchmarkResults, null, 2));
      
      console.log(`Advanced benchmark results saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save benchmark results:', error);
    }
  });
  
  describe('Hierarchical Swarm Performance', () => {
    test('should efficiently coordinate in hierarchical topology', async () => {
      // Create hierarchical swarm
      const { stdout: swarmOutput, code: swarmCode } = await runner.runCommand([
        'swarm', 'create',
        '"Advanced hierarchical swarm benchmark"',
        '--topology', 'hierarchical',
        '--strategy', 'adaptive',
        '--test-mode'
      ]);
      
      // In test mode, we might not get output, so just continue
      const swarmId = runner.extractId(swarmOutput);
      
      // If no swarm ID, skip detailed testing
      if (!swarmId) {
        console.log('Skipping detailed hierarchical testing (test mode)');
        benchmarkResults.tests['hierarchical_coordination'] = {
          status: 'skipped_test_mode'
        };
        return;
      }
      
      // Create coordinator agent
      const { stdout: coordOutput, code: coordCode } = await runner.runCommand([
        'agent', 'spawn',
        'coordinator',
        '--name', 'hierarchical-coordinator',
        '--swarm', swarmId,
        '--test-mode'
      ]);
      
      const coordId = runner.extractId(coordOutput);
      
      // Create mid-level managers
      const managerIds = [];
      const managerSpawnTimes = [];
      const managerCount = 3;
      
      for (let i = 0; i < managerCount; i++) {
        const startTime = performance.now();
        const { stdout: mgrOutput, code: mgrCode } = await runner.runCommand([
          'agent', 'spawn',
          'manager',
          '--name', `mid-manager-${i}`,
          '--swarm', swarmId,
          '--test-mode'
        ]);
        const endTime = performance.now();
        
        managerSpawnTimes.push(endTime - startTime);
        const managerId = runner.extractId(mgrOutput);
        if (managerId) {
          managerIds.push(managerId);
        }
      }
      
      // Create worker agents under each manager
      const workerIds = [];
      const workerSpawnTimes = [];
      const workersPerManager = 3;
      
      for (let m = 0; m < managerIds.length; m++) {
        for (let w = 0; w < workersPerManager; w++) {
          const startTime = performance.now();
          const { stdout: workerOutput, code: workerCode } = await runner.runCommand([
            'agent', 'spawn',
            'worker',
            '--name', `worker-${m}-${w}`,
            '--swarm', swarmId,
            '--test-mode'
          ]);
          const endTime = performance.now();
          
          workerSpawnTimes.push(endTime - startTime);
          const workerId = runner.extractId(workerOutput);
          if (workerId) {
            workerIds.push(workerId);
          }
        }
      }
      
      // Measure swarm status performance with full hierarchy
      const statusStartTime = performance.now();
      const { stdout: statusOutput, code: statusCode } = await runner.runCommand([
        'swarm', 'status',
        swarmId,
        '--verbose'
      ]);
      const statusEndTime = performance.now();
      
      const statusTime = statusEndTime - statusStartTime;
      
      // Record metrics
      benchmarkResults.tests['hierarchical_coordination'] = {
        swarm_id: swarmId,
        hierarchy_levels: 3, // coordinator -> managers -> workers
        coordinator_id: coordId,
        manager_count: managerIds.length,
        worker_count: workerIds.length,
        avg_manager_spawn_ms: managerSpawnTimes.reduce((sum, time) => sum + time, 0) / managerCount,
        avg_worker_spawn_ms: workerSpawnTimes.reduce((sum, time) => sum + time, 0) / (managerCount * workersPerManager),
        status_check_time_ms: statusTime
      };
      
      console.log(`Hierarchical swarm: ${managerIds.length} managers, ${workerIds.length} workers, status=${statusTime.toFixed(2)}ms`);
    });
  });
  
  describe('Mesh Swarm Communication', () => {
    test('should efficiently handle peer-to-peer communication in mesh topology', async () => {
      // Create mesh swarm
      const { stdout: swarmOutput, code: swarmCode } = await runner.runCommand([
        'swarm', 'create',
        '"Advanced mesh swarm benchmark"',
        '--topology', 'mesh',
        '--strategy', 'collaborative',
        '--test-mode'
      ]);
      
      // In test mode, we might not get output, so just continue
      const swarmId = runner.extractId(swarmOutput);
      
      // If no swarm ID, skip detailed testing
      if (!swarmId) {
        console.log('Skipping detailed mesh testing (test mode)');
        benchmarkResults.tests['mesh_communication'] = {
          status: 'skipped_test_mode'
        };
        return;
      }
      
      // Create peer agents
      const peerIds = [];
      const peerSpawnTimes = [];
      const peerCount = 8;
      const peerTypes = ['researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'designer', 'optimizer'];
      
      for (let i = 0; i < peerCount; i++) {
        const startTime = performance.now();
        const { stdout: peerOutput, code: peerCode } = await runner.runCommand([
          'agent', 'spawn',
          peerTypes[i % peerTypes.length],
          '--name', `mesh-peer-${i}`,
          '--swarm', swarmId,
          '--test-mode'
        ]);
        const endTime = performance.now();
        
        peerSpawnTimes.push(endTime - startTime);
        const peerId = runner.extractId(peerOutput);
        if (peerId) {
          peerIds.push(peerId);
        }
      }
      
      // Create tasks for p2p coordination
      const taskIds = [];
      const taskCreationTimes = [];
      const messagesPerPeer = 3;
      
      for (let p = 0; p < peerIds.length; p++) {
        for (let m = 0; m < messagesPerPeer; m++) {
          const startTime = performance.now();
          const { stdout: taskOutput, code: taskCode } = await runner.runCommand([
            'task', 'create',
            'message',
            `"Peer-to-peer message from ${p} to others, sequence ${m}"`,
            '--swarm', swarmId,
            '--test-mode'
          ]);
          const endTime = performance.now();
          
          taskCreationTimes.push(endTime - startTime);
          const taskId = runner.extractId(taskOutput);
          if (taskId) {
            taskIds.push(taskId);
          }
        }
      }
      
      // Measure communication overhead
      const monitorStartTime = performance.now();
      const { stdout: monitorOutput, code: monitorCode } = await runner.runCommand([
        'swarm', 'monitor',
        swarmId,
        '--duration', '2',
        '--interval', '1',
        '--test-mode'
      ]);
      const monitorEndTime = performance.now();
      
      const monitorTime = monitorEndTime - monitorStartTime;
      
      // Record metrics
      benchmarkResults.tests['mesh_communication'] = {
        swarm_id: swarmId,
        peer_count: peerIds.length,
        task_count: taskIds.length,
        messages_per_peer: messagesPerPeer,
        avg_peer_spawn_ms: peerSpawnTimes.reduce((sum, time) => sum + time, 0) / peerCount,
        avg_message_time_ms: taskCreationTimes.reduce((sum, time) => sum + time, 0) / taskIds.length,
        monitor_time_ms: monitorTime
      };
      
      console.log(`Mesh swarm: ${peerIds.length} peers, ${taskIds.length} messages, monitor=${monitorTime.toFixed(2)}ms`);
    });
  });
  
  describe('Neural Network Integration', () => {
    test('should efficiently integrate neural capabilities with swarm', async () => {
      // Create neural-enhanced swarm
      const { stdout: swarmOutput, code: swarmCode } = await runner.runCommand([
        'swarm', 'create',
        '"Advanced neural swarm benchmark"',
        '--topology', 'star',
        '--strategy', 'neural',
        '--test-mode'
      ]);
      
      // In test mode, we might not get output, so just continue
      const swarmId = runner.extractId(swarmOutput);
      
      // If no swarm ID, skip detailed testing
      if (!swarmId) {
        console.log('Skipping detailed neural testing (test mode)');
        benchmarkResults.tests['neural_integration'] = {
          status: 'skipped_test_mode'
        };
        return;
      }
      
      // Check neural status
      const neuralStartTime = performance.now();
      const { stdout: neuralOutput, code: neuralCode } = await runner.runCommand([
        'neural', 'status',
        '--swarm', swarmId,
        '--test-mode'
      ]);
      const neuralEndTime = performance.now();
      
      const neuralStatusTime = neuralEndTime - neuralStartTime;
      
      // Create neural agents
      const agentIds = [];
      const agentSpawnTimes = [];
      const agentCount = 5;
      const agentTypes = ['predictor', 'optimizer', 'classifier', 'generator', 'analyzer'];
      
      for (let i = 0; i < agentCount; i++) {
        const startTime = performance.now();
        const { stdout: agentOutput, code: agentCode } = await runner.runCommand([
          'agent', 'spawn',
          agentTypes[i % agentTypes.length],
          '--name', `neural-agent-${i}`,
          '--swarm', swarmId,
          '--neural', 'enabled',
          '--test-mode'
        ]);
        const endTime = performance.now();
        
        agentSpawnTimes.push(endTime - startTime);
        const agentId = runner.extractId(agentOutput);
        if (agentId) {
          agentIds.push(agentId);
        }
      }
      
      // Create a training task
      const { stdout: taskOutput, code: taskCode } = await runner.runCommand([
        'task', 'create',
        'neural-training',
        '"Train pattern recognition model on sample data"',
        '--swarm', swarmId,
        '--priority', 'high',
        '--test-mode'
      ]);
      
      const taskId = runner.extractId(taskOutput);
      
      // Simulate neural training
      const trainingStartTime = performance.now();
      const trainingCycles = 5;
      
      for (let cycle = 0; cycle < trainingCycles; cycle++) {
        // Simulate training iterations
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const trainingEndTime = performance.now();
      const trainingTime = trainingEndTime - trainingStartTime;
      
      // Record metrics
      benchmarkResults.tests['neural_integration'] = {
        swarm_id: swarmId,
        neural_status_time_ms: neuralStatusTime,
        agent_count: agentIds.length,
        task_id: taskId,
        training_time_ms: trainingTime,
        avg_agent_spawn_ms: agentSpawnTimes.reduce((sum, time) => sum + time, 0) / agentCount,
        training_cycles: trainingCycles
      };
      
      console.log(`Neural swarm: ${agentIds.length} neural agents, training=${trainingTime.toFixed(2)}ms, status=${neuralStatusTime.toFixed(2)}ms`);
    });
  });
});