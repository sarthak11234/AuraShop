const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⚡ Preparing static export build for GitHub Pages...');

const rootDir = path.resolve(__dirname, '..');
const tempBackupDir = path.join(rootDir, '.static-export-backup');

if (fs.existsSync(tempBackupDir)) {
  fs.rmSync(tempBackupDir, { recursive: true, force: true });
}
fs.mkdirSync(tempBackupDir, { recursive: true });

// Step 1: Temporarily stash server-only routes and server-only modules
const itemsToExclude = [
  'src/app/api',
  'src/app/account',
  'src/app/admin',
  'src/proxy.ts',
  'src/lib/products.ts',
];

const backedUp = [];

try {
  for (const item of itemsToExclude) {
    const fullPath = path.join(rootDir, item);
    if (fs.existsSync(fullPath)) {
      const destPath = path.join(tempBackupDir, item);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.renameSync(fullPath, destPath);
      backedUp.push(item);
      console.log(`  [Stashed server-only] ${item}`);
    }
  }

  // Swap products.ts with products-export.ts (which imports static-products cleanly without 'use cache')
  const productsExportPath = path.join(rootDir, 'src/lib/products-export.ts');
  const targetProductsPath = path.join(rootDir, 'src/lib/products.ts');
  fs.copyFileSync(productsExportPath, targetProductsPath);
  console.log('  [Substituted static] src/lib/products.ts');

  // Step 2: Run next build with static export environment variables
  console.log('⚡ Running next build with NEXT_PUBLIC_STATIC_EXPORT=true...');
  execSync('npx next build --webpack', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_STATIC_EXPORT: 'true',
    },
  });

  // Step 3: Add .nojekyll to out/ directory for GitHub Pages
  const outDir = path.join(rootDir, 'out');
  if (fs.existsSync(outDir)) {
    fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    console.log('✓ Created out/.nojekyll');

    // Post-process HTML, JS, CSS, and TXT files in out/ to prefix root-relative /images/, /models/, /videos/ with /AuraShop
    function processDir(dir) {
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          processDir(full);
        } else if (
          item.endsWith('.html') ||
          item.endsWith('.js') ||
          item.endsWith('.css') ||
          item.endsWith('.txt')
        ) {
          let content = fs.readFileSync(full, 'utf8');
          let changed = false;
          const patterns = [
            /(?<!\/AuraShop)\/images\//g,
            /(?<!\/AuraShop)\/models\//g,
            /(?<!\/AuraShop)\/videos\//g,
          ];
          for (const p of patterns) {
            if (p.test(content)) {
              content = content.replace(p, (match) => {
                if (match.startsWith('/images/')) return '/AuraShop/images/';
                if (match.startsWith('/models/')) return '/AuraShop/models/';
                if (match.startsWith('/videos/')) return '/AuraShop/videos/';
                return match;
              });
              changed = true;
            }
          }
          if (changed) {
            fs.writeFileSync(full, content);
          }
        }
      }
    }
    processDir(outDir);
    console.log('✓ Normalized asset paths with /AuraShop prefix');
  }

  console.log('✓ Static export build complete!');
} catch (error) {
  console.error('Build error:', error);
  throw error;
} finally {
  // Always restore stashed routes and original products.ts
  console.log('⚡ Restoring stashed files...');
  for (const item of backedUp) {
    const backupPath = path.join(tempBackupDir, item);
    const originalPath = path.join(rootDir, item);
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(originalPath)) {
        fs.rmSync(originalPath, { recursive: true, force: true });
      }
      fs.renameSync(backupPath, originalPath);
      console.log(`  [Restored] ${item}`);
    }
  }
  if (fs.existsSync(tempBackupDir)) {
    fs.rmSync(tempBackupDir, { recursive: true, force: true });
  }
}
