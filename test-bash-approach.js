#!/usr/bin/env node

/**
 * Test Bash Script Approach
 * Try running Claude CLI through a bash script instead of direct spawn
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

console.log('🧪 Testing bash script approach...');

async function testBashApproach() {
  try {
    // Create temporary script
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bash-test-'));
    const scriptPath = path.join(tempDir, 'run-claude.sh');
    
    const bashScript = `#!/bin/bash
cd /tmp
claude -p "Create a hello.txt file with content" --dangerously-skip-permissions --allowedTools "Edit" "WriteFile:*" | tee output.txt
echo "EXIT_CODE: $?"
`;

    await fs.writeFile(scriptPath, bashScript);
    await fs.chmod(scriptPath, 0o755);
    
    console.log('📝 Created bash script:', scriptPath);
    console.log('📋 Script content:', bashScript);
    
    // Execute bash script
    const process = spawn('bash', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log('📺 STDOUT:', chunk);
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log('📻 STDERR:', chunk);
    });
    
    process.on('close', async (code) => {
      console.log(`🚪 Process exited with code: ${code}`);
      console.log('📄 Final STDOUT:', stdout);
      console.log('📄 Final STDERR:', stderr);
      
      // Check if files were created
      try {
        const outputExists = await fs.access('/tmp/output.txt').then(() => true).catch(() => false);
        const helloExists = await fs.access('/tmp/hello.txt').then(() => true).catch(() => false);
        
        console.log('📁 Files created:');
        console.log('  output.txt:', outputExists);
        console.log('  hello.txt:', helloExists);
        
        if (outputExists) {
          const outputContent = await fs.readFile('/tmp/output.txt', 'utf-8');
          console.log('📖 output.txt content:', outputContent);
        }
        
        if (helloExists) {
          const helloContent = await fs.readFile('/tmp/hello.txt', 'utf-8');
          console.log('📖 hello.txt content:', helloContent);
        }
      } catch (error) {
        console.log('❌ Error checking files:', error.message);
      }
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      process.exit(code || 0);
    });
    
    process.on('error', (error) => {
      console.error('❌ Process error:', error);
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testBashApproach(); 