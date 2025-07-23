/**
 * MCP Tools Module Exports
 * Comprehensive 87 tools suite for advanced AI orchestration
 */

// Export main classes
export { AdvancedToolRegistry } from './advanced-tool-registry.js';
export type { AdvancedTool } from './advanced-tool-registry.js';
export { AdvancedToolServer } from './advanced-tool-server.js';
export type { ToolServerStatistics } from './advanced-tool-server.js';

// Create and export default instances for convenience
import { AdvancedToolRegistry } from './advanced-tool-registry.js';
import { AdvancedToolServer } from './advanced-tool-server.js';

export const toolRegistry = new AdvancedToolRegistry();
export const toolServer = new AdvancedToolServer();

// Export helper functions
export async function getToolStatistics() {
  const tools = await toolRegistry.listTools();
  return {
    totalTools: tools.length,
    enterpriseTools: tools.filter((t: any) => t.enterprise).length,
    authenticatedTools: tools.filter((t: any) => t.requiresAuth).length,
    priorities: {
      critical: tools.filter((t: any) => t.priority === 'critical').length,
      high: tools.filter((t: any) => t.priority === 'high').length,
      medium: tools.filter((t: any) => t.priority === 'medium').length,
      low: tools.filter((t: any) => t.priority === 'low').length
    },
    categoryBreakdown: tools.reduce((acc: any, tool: any) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

// Tool categories
export const MCP_TOOL_CATEGORIES = [
  'development',
  'data_management', 
  'communication',
  'cloud_infrastructure',
  'security',
  'productivity',
  'analytics',
  'content_creation',
  'deployment',
  'monitoring',
  'neural_computing',
  'enterprise_integration'
] as const;

export type MCPToolCategory = typeof MCP_TOOL_CATEGORIES[number]; 