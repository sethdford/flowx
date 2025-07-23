/**
 * Jest setup for common type issues
 */

// Extend global types for test environment
declare global {
  var printInfo: any;
  var printError: any;
  var printSuccess: any;
  var printWarning: any;
  
  interface ImportMeta {
    main?: boolean;
  }
  
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      mockResolvedValue(value: T): this;
      mockReturnValue(value: T): this;
      mockImplementation(fn?: (...args: Y) => T): this;
    }
  }
}

// Mock common missing modules
jest.mock('@cliffy/ansi/colors', () => ({
  colors: {
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    blue: (text: string) => text,
    cyan: (text: string) => text,
    magenta: (text: string) => text,
    gray: (text: string) => text,
    bold: (text: string) => text,
    dim: (text: string) => text
  }
}));

// Export empty to make this a module
export {}; 