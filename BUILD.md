# Build Instructions

This extension uses code obfuscation and minification to protect the source code before publishing to the Chrome Web Store.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Building for Production

1. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```

3. **Test the build**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder
   - Test all functionality to ensure everything works

4. **Prepare for Chrome Web Store**:
   - Zip the contents of the `dist/` folder (not the folder itself)
   - Upload the zip file to the Chrome Web Store Developer Dashboard

## What the Build Does

- **Minifies** JavaScript files (removes whitespace, shortens code)
- **Obfuscates** code (makes it extremely difficult to read)
- **Removes** console.log statements
- **Copies** static files (HTML, manifest, icons) unchanged
- **Outputs** production-ready files to `dist/` folder

## File Sizes

After obfuscation, files will be larger than the originals. This is normal and expected - the obfuscation process adds complexity to make reverse engineering difficult.

## Development vs Production

- **Development**: Edit files in the root directory (`background.js`, `content.js`, `popup.js`, etc.)
- **Production**: Always test and publish from the `dist/` folder after running `npm run build`

## Cleaning

To remove the build output:
```bash
npm run clean
```





