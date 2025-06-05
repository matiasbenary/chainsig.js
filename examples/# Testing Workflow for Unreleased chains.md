# Testing Workflow for Unreleased chainsig.js Versions

## 1. Local Development Setup
```bash
# In chainsig.js directory
npm run build

# In near-multichain directory  
npm install chainsig.js@file:../chainsig.js/dist
```

This creates a symbolic link to your local build, so changes are reflected immediately after rebuilding.

## 2. Development Cycle
```bash
# Make changes to chainsig.js source
# Then rebuild:
cd chainsig.js
npm run build

# The near-multichain project automatically picks up changes
cd ../near-multichain
npm run dev
```

## 3. Package.json Configuration
In `near-multichain/package.json`:
```json
{
  "dependencies": {
    "chainsig.js": "file:../chainsig.js/dist"
  }
}
```

## 4. Switching Between Local and Published
- **Local testing**: `"chainsig.js": "file:../chainsig.js/dist"`
- **Published version**: `"chainsig.js": "^1.1.6"`
