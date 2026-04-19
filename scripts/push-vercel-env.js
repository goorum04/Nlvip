const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const envs = [
  { key: 'APNS_TEAM_ID', value: process.env.APNS_TEAM_ID },
  { key: 'APNS_KEY_ID', value: process.env.APNS_KEY_ID },
  { key: 'APNS_BUNDLE_ID', value: process.env.APNS_BUNDLE_ID },
  { key: 'APNS_P8_KEY', value: process.env.APNS_P8_KEY || '' }
];

const targetEnvs = ['production', 'preview', 'development'];

for (const env of envs) {
  if (!env.value) continue;
  const tmpFile = `c:\\Users\\gooru\\temp_vercel_${env.key}.txt`;
  fs.writeFileSync(tmpFile, env.value);
  
  try {
    console.log(`Removing ${env.key} if exists...`);
    execSync(`npx vercel env rm ${env.key} production preview development -y`, { stdio: 'ignore' });
  } catch (e) {}

  for (const target of targetEnvs) {
    try {
      console.log(`Setting ${env.key} for ${target}...`);
      execSync(`npx vercel env add ${env.key} ${target} < "${tmpFile}"`, { stdio: 'inherit' });
      console.log(`✅ ${env.key} set successfully for ${target}.`);
    } catch (error) {
      console.error(`❌ Failed to set ${env.key} for ${target}`);
      console.error(error.message);
    }
  }
  try { fs.unlinkSync(tmpFile); } catch(e){}
}
