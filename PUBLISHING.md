# NPM Publishing Checklist

## Pre-Publish Steps

1. **Update package.json**
   - ✅ Changed name to `@chirag-parmar/atlas-sandbox` (scoped package)
   - ✅ Added description
   - ✅ Added keywords
   - ✅ Added author
   - ✅ Changed license to MIT
   - ✅ Added repository URL
   - ✅ Added files whitelist
   - ✅ Added prepublishOnly script

2. **Create LICENSE file**
   - ✅ Created MIT license

3. **Build the project**
   - Run `npm run build`

4. **Test locally**
   - Run `npm link` to test globally

## Publishing Steps

### First Time Setup
```bash
npm login
# Enter your npm credentials
```

### Publish
```bash
npm publish --access public
```

**Note**: Scoped packages (@username/package) require `--access public` flag for free accounts.

## After Publishing

### Installation command will be:
```bash
npm install -g @chirag-parmar/atlas-sandbox
```

### Alternative Name Options
If you want a different name, here are some available alternatives:
- `atlas-dev-sandbox`
- `atlas-chrome-sandbox`
- `local-atlas`
- `dev-atlas-cli`

Check availability: `npm view <package-name>`
