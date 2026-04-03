#!/usr/bin/env node
/**
 * Run once to generate VAPID keys for Web Push:
 *   node scripts/generate-vapid-keys.js
 *
 * Copy the output into your .env.local (or Vercel/hosting env vars).
 */
const webpush = require('web-push')

const keys = webpush.generateVAPIDKeys()

console.log('\nAdd these to your .env.local:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_EMAIL=mailto:support@nlvipnutrition.com`)
console.log('\nDone. Keep VAPID_PRIVATE_KEY secret.\n')
