/**
 * Swarm List Command
 * Lists active swarms.
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printInfo, formatTable } from '../../core/output-formatter.js';

async function handler(context: CLIContext): Promise<void> {
  printInfo('Listing active swarms...');
  // In a real implementation, this would fetch data from a swarm manager service
  // For now, we'll just show a placeholder.
  const swarms = [
    { id: 'swarm-123', name: 'java-hello-world-builder', status: 'running', agents: 2 },
  ];

  const columns = [
    { header: 'ID', key: 'id' },
    { header: 'Name', key: 'name' },
    { header: 'Status', key: 'status' },
    { header: 'Agents', key: 'agents' }
  ];
  
  const table = formatTable(swarms, columns);

  console.log(table);
}

export const listSwarmCommand: CLICommand = {
  name: 'list',
  description: 'Lists all active swarms.',
  handler,
}; 