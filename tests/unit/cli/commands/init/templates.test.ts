/**
 * Template Generation Tests for Claude Flow
 */

import { describe, it, expect } from '@jest/globals';
import { 
  createFullClaudeMd, 
  createMinimalClaudeMd, 
  createSparcClaudeMd 
} from "../../../../../src/cli/simple-commands/init/templates/claude-md";
import { 
  createFullMemoryBankMd, 
  createMinimalMemoryBankMd 
} from "../../../../../src/cli/simple-commands/init/templates/memory-bank-md";
import { 
  createFullCoordinationMd, 
  createMinimalCoordinationMd 
} from "../../../../../src/cli/simple-commands/init/templates/coordination-md";
import { 
  createAgentsReadme, 
  createSessionsReadme 
} from "../../../../../src/cli/simple-commands/init/templates/readme-files";

describe("Template Generation Tests", () => {
  describe("CLAUDE.md templates", () => {
    it("should generate full CLAUDE.md with proper structure", () => {
      const content = createFullClaudeMd("Test Project", { version: "1.0.0" });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("## Project Overview");
      expect(content).toContain("Claude Flow Project");
    });

    it("should generate minimal CLAUDE.md with basic info", () => {
      const content = createMinimalClaudeMd("Test Project", { version: "1.0.0" });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("## Overview");
    });

    it("should generate SPARC-enhanced CLAUDE.md", () => {
      const content = createSparcClaudeMd("Test Project", { sparc: true });
      
      expect(content).toContain("Test Project");
      expect(content).toContain("SPARC Methodology");
      expect(content).toContain("## SPARC Structure");
      expect(content).toContain("**S**pecification");
      expect(content).toContain("**P**seudocode");
      expect(content).toContain("**A**rchitecture");
      expect(content).toContain("**R**eview");
      expect(content).toContain("**C**ode");
    });

    it("should include proper SPARC commands in SPARC template", () => {
      const content = createSparcClaudeMd("Test Project", { 
        commands: ["npx flowx sparc modes"] 
      });
      
      expect(content).toContain("Test Project");
      expect(content).toContain("SPARC Methodology");
    });
  });

  describe("memory-bank.md templates", () => {
    it("should generate full memory bank with sections", () => {
      const content = createFullMemoryBankMd("Test Project", { 
        features: ["persistent", "semantic", "categorization"] 
      });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Memory Bank");
    });

    it("should generate minimal memory bank", () => {
      const content = createMinimalMemoryBankMd("Test Project", {});
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Memory Bank");
    });
  });

  describe("coordination.md templates", () => {
    it("should generate full coordination with agent structure", () => {
      const content = createFullCoordinationMd("Test Project", { 
        agents: 5,
        strategies: ["mesh", "hierarchical"] 
      });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Agent Coordination");
    });

    it("should generate minimal coordination", () => {
      const content = createMinimalCoordinationMd("Test Project", { agents: 3 });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Agent Coordination");
    });
  });

  describe("README templates", () => {
    it("should generate agents README with proper format", () => {
      const content = createAgentsReadme("Test Project", { 
        agentTypes: ["coordinator", "researcher", "coder"] 
      });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Agents");
    });

    it("should generate sessions README with proper format", () => {
      const content = createSessionsReadme("Test Project", { 
        sessionTypes: ["interactive", "batch", "collaborative"] 
      });
      
      expect(content).toContain("# Test Project");
      expect(content).toContain("Sessions");
    });
  });

  describe("Template consistency", () => {
    it("should include proper file extensions in examples", () => {
      const content = createSparcClaudeMd("Test Project", { 
        examples: [".json", ".md", ".ts"] 
      });
      
      expect(content).toContain("Test Project");
    });

    it("should include proper command examples", () => {
      const content = createFullClaudeMd("Test Project", { 
        commands: ["flowx start", "flowx agent spawn"] 
      });
      
      expect(content).toContain("Test Project");
    });
  });

  describe("SPARC-specific content", () => {
    it("should include all SPARC modes in template", () => {
      const content = createSparcClaudeMd("Test Project", { 
        sparcModes: ["architect", "researcher", "coder", "reviewer"] 
      });
      
      expect(content).toContain("Test Project");
    });

    it("should include workflow examples", () => {
      const content = createSparcClaudeMd("Test Project", { 
        workflows: ["feature-development", "bug-fix", "optimization"] 
      });
      
      expect(content).toContain("Test Project");
    });

    it("should include memory integration examples", () => {
      const content = createSparcClaudeMd("Test Project", { 
        memoryIntegration: true 
      });
      
      expect(content).toContain("Test Project");
    });
  });
});