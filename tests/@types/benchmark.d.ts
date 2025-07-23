declare module 'benchmark' {
  export = Benchmark;
  
  declare class Benchmark {
    constructor(name: string, fn: Function, options?: any);
    static Suite: typeof Suite;
    run(): this;
    on(event: string, callback: Function): this;
  }
  
  declare class Suite {
    constructor(name?: string, options?: any);
    add(name: string, fn: Function, options?: any): this;
    run(): this;
    on(event: string, callback: Function): this;
  }
} 