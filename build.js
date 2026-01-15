const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Configuration
const OBFUSCATION_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // Set to false to avoid breaking extension
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Files to process
const JS_FILES = [
    'background.js',
    'content.js',
    'popup.js'
];

// Files to copy as-is
const COPY_FILES = [
    'popup.html',
    'manifest.json',
    'LICENSE'
];

// Directories to copy
const COPY_DIRS = [
    'icons'
];

async function build() {
    console.log('🚀 Starting build process...\n');
    
    // Clean dist directory
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
        await fs.remove(distDir);
    }
    await fs.ensureDir(distDir);
    
    // Process JavaScript files
    console.log('📦 Processing JavaScript files...');
    for (const file of JS_FILES) {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Warning: ${file} not found, skipping...`);
            continue;
        }
        
        console.log(`  → Processing ${file}...`);
        const code = await fs.readFile(filePath, 'utf8');
        
        // First minify with terser
        const minified = await minify(code, {
            compress: {
                drop_console: true, // Remove console.log statements
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug'],
                passes: 2
            },
            mangle: {
                toplevel: false, // Keep top-level names for Chrome extension APIs
                reserved: ['chrome', 'browser', 'window', 'document']
            },
            format: {
                comments: false
            }
        });
        
        if (minified.error) {
            console.error(`❌ Error minifying ${file}:`, minified.error);
            process.exit(1);
        }
        
        // Then obfuscate
        const obfuscationResult = JavaScriptObfuscator.obfuscate(minified.code, OBFUSCATION_OPTIONS);
        const obfuscatedCode = obfuscationResult.getObfuscatedCode();
        
        // Write to dist
        const distPath = path.join(distDir, file);
        await fs.writeFile(distPath, obfuscatedCode, 'utf8');
        
        const originalSize = (code.length / 1024).toFixed(2);
        const finalSize = (obfuscatedCode.length / 1024).toFixed(2);
        console.log(`    ✓ ${file}: ${originalSize}KB → ${finalSize}KB`);
    }
    
    // Copy non-JS files
    console.log('\n📋 Copying static files...');
    for (const file of COPY_FILES) {
        const srcPath = path.join(__dirname, file);
        const distPath = path.join(distDir, file);
        
        if (fs.existsSync(srcPath)) {
            await fs.copy(srcPath, distPath);
            console.log(`  ✓ Copied ${file}`);
        } else {
            console.warn(`  ⚠️  ${file} not found, skipping...`);
        }
    }
    
    // Copy directories
    console.log('\n📁 Copying directories...');
    for (const dir of COPY_DIRS) {
        const srcPath = path.join(__dirname, dir);
        const distPath = path.join(distDir, dir);
        
        if (fs.existsSync(srcPath)) {
            await fs.copy(srcPath, distPath);
            console.log(`  ✓ Copied ${dir}/`);
        } else {
            console.warn(`  ⚠️  ${dir}/ not found, skipping...`);
        }
    }
    
    // Copy content directory if it exists (for any additional JS files)
    const contentDir = path.join(__dirname, 'content');
    const distContentDir = path.join(distDir, 'content');
    if (fs.existsSync(contentDir)) {
        // Check if content.js imports these files - if not, we might not need to copy them
        // For now, we'll copy the structure but note that content.js should bundle everything
        console.log('\n📁 Checking content directory...');
        console.log('  ℹ️  Note: If content.js imports files from content/, ensure they are bundled.');
    }
    
    console.log('\n✅ Build complete!');
    console.log(`📦 Production files are in: ${distDir}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Test the extension from the dist/ folder');
    console.log('   2. Zip the dist/ folder contents');
    console.log('   3. Upload to Chrome Web Store\n');
}

// Run build
build().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
});





