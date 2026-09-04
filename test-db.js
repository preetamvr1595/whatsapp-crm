const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');

  if (parts.length === 3) {
    const [ivHex, ctHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ctHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  if (parts.length === 2) {
    const [ivHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    let decrypted = decipher.update(ctHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  throw new Error('Unrecognised format');
}

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Supabase URL:', url);
  if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local!');
    return;
  }

  const supabase = createClient(url, key);
  const { data: configs, error } = await supabase
    .from('whatsapp_config')
    .select('*');

  if (error) {
    console.error('Error fetching configs:', error);
    return;
  }

  console.log(`Found ${configs.length} configs:`);
  for (const config of configs) {
    let decryptedVerifyToken = 'Failed to decrypt';
    try {
      decryptedVerifyToken = decrypt(config.verify_token);
    } catch (e) {
      decryptedVerifyToken = `Error: ${e.message}`;
    }
    console.log({
      id: config.id,
      user_id: config.user_id,
      phone_number_id: config.phone_number_id,
      encrypted_verify_token: config.verify_token,
      decrypted_verify_token: decryptedVerifyToken
    });
  }
}

run();
