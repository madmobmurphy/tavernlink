const ENC_ALGO = { name: 'AES-GCM', length: 256 };

export async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', 
    enc.encode(password), 
    { name: 'PBKDF2' }, 
    false, 
    ['deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    { 
      name: 'PBKDF2', 
      salt: enc.encode('tavernlink_salt_v1'), 
      iterations: 100000, 
      hash: 'SHA-256' 
    },
    keyMaterial,
    ENC_ALGO,
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text: string, key: CryptoKey): Promise<string> {
  try {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, 
      key, 
      enc.encode(text)
    );
    
    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    
    const dataHex = Array.from(new Uint8Array(encrypted))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
      
    return `${ivHex}:${dataHex}`;
  } catch (e) {
    console.error("Encryption failed", e);
    return text;
  }
}

export async function decryptMessage(cipherText: string, key: CryptoKey): Promise<string> {
  try {
    if (!cipherText.includes(':')) return cipherText; // Not encrypted or system message
    
    const [ivHex, dataHex] = cipherText.split(':');
    if (!ivHex || !dataHex) return cipherText;
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    const data = new Uint8Array(dataHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, 
      key, 
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return '🛡️ [Encrypted Message - Cannot Decrypt]';
  }
}