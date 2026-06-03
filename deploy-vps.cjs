#!/usr/bin/env node
/**
 * Deploy CRM para VPS Contabo
 * Uso: node deploy-vps.cjs
 *
 * 1. npm run build
 * 2. Compacta dist/ em tar.gz
 * 3. Upload via SFTP para /opt/crm-app
 * 4. Extrai e limpa
 */
const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VPS = {
  host: '207.180.212.113',
  port: 22,
  username: 'root',
  password: 'waN5W.3gvG6n',
  readyTimeout: 30000,
};
const REMOTE_DIR = '/opt/crm-app';
const TAR_NAME = 'dist.tar.gz';
const TAR_PATH = path.join(__dirname, TAR_NAME);

async function run() {
  // 1. Build
  console.log('1/4 Building...');
  execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });

  // 2. Compress
  console.log('\n2/4 Compressing dist/...');
  execSync(`tar czf ${TAR_NAME} -C dist .`, { cwd: __dirname });
  const size = (fs.statSync(TAR_PATH).size / 1024).toFixed(0);
  console.log(`   ${size} KB`);

  // 3. Upload + Extract
  console.log('\n3/4 Uploading to VPS...');
  await new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        const rs = fs.createReadStream(TAR_PATH);
        const ws = sftp.createWriteStream(`${REMOTE_DIR}/${TAR_NAME}`);
        ws.on('close', () => {
          console.log('   Upload complete.');
          console.log('\n4/4 Extracting on VPS...');
          const cmd = `cd ${REMOTE_DIR} && rm -rf assets *.html *.ico *.png *.svg *.txt sounds 2>/dev/null; tar xzf ${TAR_NAME} && rm ${TAR_NAME} && echo "OK: $(ls -la | wc -l) files deployed"`;
          conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            stream.on('data', d => process.stdout.write('   ' + d));
            stream.stderr.on('data', d => process.stderr.write('   ' + d));
            stream.on('close', () => {
              conn.end();
              resolve();
            });
          });
        });
        rs.pipe(ws);
      });
    });
    conn.on('error', reject);
    conn.connect(VPS);
  });

  // Cleanup local tar
  fs.unlinkSync(TAR_PATH);

  console.log('\n✅ Deploy concluído! https://app.crmallin.com.br');
}

run().catch(err => {
  console.error('❌ Deploy falhou:', err.message);
  process.exit(1);
});
