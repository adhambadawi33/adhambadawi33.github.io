/* App lock helpers: a hashed 4-digit PIN plus optional platform biometrics
   through WebAuthn (Face ID / Touch ID / Windows Hello). Everything stays on
   the device; nothing is ever sent anywhere. */
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPin(pin) {
  if (!globalThis.crypto?.subtle) return `plain:${pin}`;
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`pocket-ledger:${pin}`));
  return toB64(digest);
}

export const biometricsAvailable = async () => {
  try { return !!(window.PublicKeyCredential && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
};

export async function webauthnCreate() {
  try {
    if (!(await biometricsAvailable())) return null;
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Pocket Ledger", id: location.hostname },
        user: { id: enc.encode("pocket-ledger-owner"), name: "owner", displayName: "Pocket Ledger" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
      },
    });
    return cred ? toB64(cred.rawId) : null;
  } catch { return null; }
}

export async function webauthnVerify(credId) {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64(credId) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch { return false; }
}
