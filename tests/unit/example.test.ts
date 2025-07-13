import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

// Example calculator class to test
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }

  async asyncOperation(value: number): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return value * 2;
  }
}

describe("Calculator", () => {
  let calculator: Calculator;

  beforeEach(() => {
    // Setup before each test
    calculator = new Calculator();
  });

  afterEach(() => {
    // Cleanup after each test
    // In a real test, you might clean up resources here
  });

  describe("add", () => {
    it("should add two positive numbers", () => {
      const result = calculator.add(2, 3);
      expect(result).toBe(5);
    });

    it("should add two negative numbers", () => {
      const result = calculator.add(-2, -3);
      expect(result).toBe(-5);
    });

    it("should add a positive and negative number", () => {
      const result = calculator.add(5, -3);
      expect(result).toBe(2);
    });
  });

  describe("subtract", () => {
    it("should subtract two positive numbers", () => {
      const result = calculator.subtract(5, 3);
      expect(result).toBe(2);
    });

    it("should subtract a larger number from a smaller one", () => {
      const result = calculator.subtract(3, 5);
      expect(result).toBe(-2);
    });
  });

  describe("multiply", () => {
    it("should multiply two positive numbers", () => {
      const result = calculator.multiply(3, 4);
      expect(result).toBe(12);
    });

    it("should multiply by zero", () => {
      const result = calculator.multiply(5, 0);
      expect(result).toBe(0);
    });

    it("should multiply negative numbers", () => {
      const result = calculator.multiply(-3, -4);
      expect(result).toBe(12);
    });
  });

  describe("divide", () => {
    it("should divide two positive numbers", () => {
      const result = calculator.divide(8, 2);
      expect(result).toBe(4);
    });

    it("should throw error when dividing by zero", () => {
      expect(() => calculator.divide(5, 0)).toThrow("Division by zero");
    });

    it("should handle negative division", () => {
      const result = calculator.divide(-8, 2);
      expect(result).toBe(-4);
    });
  });

  describe("asyncOperation", () => {
    it("should handle async operations", async () => {
      const result = await calculator.asyncOperation(5);
      expect(result).toBe(10);
    });

    it("should handle async operations with different values", async () => {
      const result = await calculator.asyncOperation(7);
      expect(result).toBe(14);
    });
  });
});

describe("Calculator with mocks", () => {
  it("should spy on method calls", () => {
    const calculator = new Calculator();
    const addSpy = jest.spyOn(calculator, "add");

    calculator.add(2, 3);
    calculator.add(4, 5);

    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(addSpy).toHaveBeenNthCalledWith(1, 2, 3);
    expect(addSpy).toHaveBeenNthCalledWith(2, 4, 5);
  });

  it("should stub a method", () => {
    const calculator = new Calculator();
    const multiplyStub = jest.spyOn(calculator, "multiply").mockReturnValue(100);

    const result = calculator.multiply(2, 3);
    expect(result).toBe(100); // Stubbed value

    multiplyStub.mockRestore();
    const realResult = calculator.multiply(2, 3);
    expect(realResult).toBe(6); // Real value after restore
  });
});