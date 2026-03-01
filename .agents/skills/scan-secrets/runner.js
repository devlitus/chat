import fs from 'fs';
import path from 'path';

// Agent Cipher: Regex patterns for secrets
const PATTERNS = [
  { name: 'GitHub Token', regex: /gh[p|o|u|s|r]_[a-zA-Z0-9]{36}/ },
  { name: 'AWS Key', regex: /(AKIA|A3T|AGPA|AIDA|ARO|AIP|ANP|ANV)[A-Z0-9]{16}/ },
  { name: 'OpenAI Key', regex: /sk-[a-zA-Z0-9]{48}/ },
  { name: 'Generic Password/Secret', regex: /(password|secret|pwd|passphrase|token|key|api_key)['"\\s]*[:=]['"\\s]*[a-zA-Z0-9\\-_]{8,}/i }
];

// Files to ignore (e.g. where the patterns themselves are defined)
const IGNORE_FILES = [
  'SKILL.md',
  'runner.js',
  '6-agente-cipher.md'
];

const filesToScan = process.argv.slice(2);
let foundSecrets = false;

console.log(`🕵️ [Agent Cipher] Scanning ${filesToScan.length} files for secrets before commit...`);

for (const filePath of filesToScan) {
  const fileName = path.basename(filePath);
  if (IGNORE_FILES.includes(fileName)) continue;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const { name, regex } of PATTERNS) {
        if (regex.test(lines[i])) {
          console.error(`\n❌ [SECURITY VIOLATION]`);
          console.error(`   A potential ${name} was found by Agent Cipher.`);
          console.error(`   File: ${filePath}:${i + 1}`);
          console.error(`   Line: ${lines[i].trim().substring(0, 50)}...`);
          console.error(`   Action: Please remove it and use an environment variable (.env).`);
          foundSecrets = true;
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Agent Cipher] Could not read file ${filePath}: ${err.message}`);
  }
}

if (foundSecrets) {
  console.error(`\n🚨 Commit BLOCKED. Secrets detected in the codebase.`);
  process.exit(1); // Block commit
} else {
  console.log(`✅ [Agent Cipher] No secrets found. Code is secure.`);
  process.exit(0); // Allow commit
}
