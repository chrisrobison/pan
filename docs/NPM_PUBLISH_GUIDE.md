# NPM Publishing Guide for LARC/PAN

## Current Status
- ✅ Already published on npm as `larc@1.0.0`
- ✅ Logged in as `cdr420`
- 🔄 Ready to publish v1.1.0 with new features

## What's New in v1.1.0

### Major Features
1. **TypeScript Support** - Complete type definitions for all APIs
2. **Enhanced Security** - Rate limiting, validation, memory management
3. **DevTools Extension** - Chrome extension for debugging
4. **Documentation Site** - 59 rendered docs, examples gallery, apps gallery
5. **JSDoc Comments** - Full inline documentation

### Files to Include
- All TypeScript definitions (*.d.ts)
- Enhanced bus (pan-bus-enhanced.mjs)
- Validation utilities (pan-validation.mjs)
- Updated core files with JSDoc

## Publishing Steps

### 1. Update Version Number
```bash
# For minor version (recommended for these features)
npm version minor

# This will bump 1.0.0 → 1.1.0
```

### 2. Build Distribution Package
```bash
# Build the dist/ folder with all new files
npm run build

# This creates dist/ with:
# - index.js (bundled core)
# - index.d.ts (TypeScript definitions)
# - core/ (including new enhanced files)
# - components/, ui/, data/, app/
```

### 3. Verify Build Contents
```bash
# Check what will be published
npm pack --dry-run

# Or check dist/ folder
ls -la dist/
```

### 4. Test Locally (Optional but Recommended)
```bash
# In PAN project
npm link

# In a test project
npm link larc

# Test the imports work
```

### 5. Publish to npm
```bash
# Publish from the dist/ folder
cd dist/
npm publish

# Or publish with npm pack first
npm publish
```

### 6. Verify Publication
```bash
# Check the published package
npm view larc

# Should show version 1.1.0 with new files
```

## Pre-Publication Checklist

### Package.json
- [x] Version number (will be updated to 1.1.0)
- [x] Description accurate
- [x] Keywords comprehensive
- [x] Repository URL correct
- [x] Author information
- [x] License (MIT)
- [x] Types field pointing to index.d.ts
- [x] Exports map configured
- [x] Files array includes all necessary files

### Build Files
- [ ] Run `npm run build` successfully
- [ ] Verify dist/index.d.ts exists
- [ ] Verify dist/core/ includes enhanced files
- [ ] Check file sizes are reasonable
- [ ] No test files or dev files included

### Documentation
- [x] README.md in dist/ folder
- [x] LICENSE file present
- [x] TypeScript guide available
- [x] Examples documented
- [x] Changelog updated

### Testing
- [ ] Import works: `import { PanClient } from 'larc'`
- [ ] TypeScript types work correctly
- [ ] All exports accessible
- [ ] No broken imports

## What Gets Published

From `packages/pan/package.json` "files" field:
```
dist/
├── index.js (bundled core)
├── index.d.ts (types)
├── autoload.js
├── autoload.d.ts
├── inspector.js
├── inspector.d.ts
├── core/
│   ├── pan-bus.js
│   ├── pan-bus-enhanced.js (NEW)
│   ├── pan-client.js
│   ├── pan-validation.js (NEW)
│   └── *.d.ts files (NEW)
├── components/ (all 60 components)
├── ui/ (UI components)
├── app/ (app components)
├── data/ (data layer)
├── package.json
├── README.md
└── LICENSE
```

## Common Issues

### Issue: "Cannot find module 'larc'"
**Solution**: Make sure you ran `npm run build` before publishing

### Issue: "TypeScript types not found"
**Solution**: Verify `types` field in package.json and index.d.ts exists in dist/

### Issue: "Package size too large"
**Solution**: Check "files" array, ensure no test/example files included

### Issue: "Version already exists"
**Solution**: Bump version with `npm version patch|minor|major`

## Size Expectations

- **Compressed**: ~200-300 KB
- **Unpacked**: ~800 KB - 1 MB
- If much larger, review what's being included

## Post-Publication

1. **Update GitHub Release**
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

2. **Create Release Notes**
   - Go to GitHub releases
   - Create new release from tag
   - Document all new features

3. **Update Website**
   - Update version badge
   - Announce new version
   - Update installation instructions

4. **Announce**
   - Tweet about it
   - Post on relevant forums
   - Update any listings

## Rollback Plan

If something goes wrong:
```bash
# Deprecate the broken version
npm deprecate larc@1.1.0 "Broken, use 1.1.1 instead"

# Publish fixed version
npm version patch
npm run build
cd dist && npm publish
```

## Quick Command Reference

```bash
# Complete publishing workflow
npm version minor              # 1.0.0 → 1.1.0
npm run build                  # Build dist/
npm run test                   # Ensure tests pass
cd dist                        # Enter dist folder
npm publish                    # Publish to npm
cd ..                          # Return to root
git push origin main --tags    # Push version tag
```

## Verification After Publishing

```bash
# Install in a fresh directory
mkdir test-larc && cd test-larc
npm init -y
npm install larc@1.1.0

# Test TypeScript
cat > test.ts << 'EOF'
import { PanClient, PanMessage } from 'larc';

const client = new PanClient();
await client.ready();

client.publish<{ value: number }>({
  topic: 'test',
  data: { value: 42 }
});
EOF

# Test JavaScript
cat > test.js << 'EOF'
import { PanClient } from 'larc';

const client = new PanClient();
await client.ready();

client.publish({
  topic: 'test',
  data: { value: 42 }
});
EOF

node test.js
```

## Success Criteria

- ✅ Package installs without errors
- ✅ TypeScript types work in IDE
- ✅ All exports accessible
- ✅ Documentation renders correctly
- ✅ Examples work as expected
- ✅ No breaking changes for 1.0.0 users

---

Ready to publish? Let's do it! 🚀
