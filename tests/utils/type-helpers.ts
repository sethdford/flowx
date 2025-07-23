/**
 * Common type helpers for tests to improve type safety
 */

// Mock result types that are commonly unknown
export type MockResult = {
  success?: boolean;
  output?: any;
  files?: Map<string, string> | any;
  artifacts?: any;
  metadata?: any;
  prediction?: any;
  confidence?: number;
  [key: string]: any;
};

// Mock task definition that satisfies most test requirements
export interface MockTaskDefinition {
  id: string | { id: string; [key: string]: any };
  name: string;
  description: string;
  type: string;
  status: string;
  priority?: string | number;
  dependencies?: any[];
  tags?: string[];
  progressPercentage?: number;
  createdAt?: Date;
  checkpoints?: any[];
  resourceRequirements?: any[];
  input?: any;
  [key: string]: any;
}

// Mock agent definition
export interface MockAgentDefinition {
  id: string | { id: string; [key: string]: any };
  name: string;
  type: string;
  status: string;
  [key: string]: any;
}

// Type assertion helpers
export const asTaskResult = (obj: any): MockResult => obj;
export const asTask = (obj: any): MockTaskDefinition => obj;
export const asAgent = (obj: any): MockAgentDefinition => obj;

// Jest mock function creators with proper typing
export const createMockFn = <T = any>() => jest.fn();
export const createMockPromise = <T = any>(value: T) => jest.fn().mockResolvedValue(value as T);
export const createMockCallback = () => jest.fn().mockImplementation(() => {});

// Common mock implementations
export const mockTaskEngine = {
  getTaskStatus: jest.fn().mockResolvedValue(null as any),
  createTask: jest.fn().mockResolvedValue('mock-task-id' as string),
  listTasks: jest.fn().mockResolvedValue({ tasks: [], total: 0, hasMore: false } as any),
  cancelTask: jest.fn().mockResolvedValue(true as boolean)
};

export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Import jest globals for consistent usage
import { jest } from '@jest/globals'; 