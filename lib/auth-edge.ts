/**
 * Standalone JWT utilities for Edge and Node Runtime
 * Bypasses dependency resolution issues by using native WebCrypto APIs
 */

const encoder = new TextEncoder();

function base64urlEncode(data: Uint8Array | string): string {
    let bytes: Uint8Array;
    if (typeof data === 'string') {
        bytes = encoder.encode(data);
    } else {
        bytes = data;
    }

    // Safely convert bytes to binary string
    const binString = Array.from(bytes, (byte) =>
        String.fromCodePoint(byte)
    ).join("");

    return btoa(binString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64urlDecode(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const binary = atob(standardBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export async function signJWT(payload: any, secret: string, options: { expires?: string } = {}) {
    try {
        const header = { alg: 'HS256', typ: 'JWT' };

        // Add iat and exp
        const now = Math.floor(Date.now() / 1000);
        const jwtPayload = {
            ...payload,
            iat: now,
        };

        if (options.expires === '2h') {
            jwtPayload.exp = now + (2 * 60 * 60);
        }

        const encodedHeader = base64urlEncode(JSON.stringify(header));
        const encodedPayload = base64urlEncode(JSON.stringify(jwtPayload));

        const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, data);
        const encodedSignature = base64urlEncode(new Uint8Array(signature));

        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    } catch (e) {
        console.error('Edge JWT Sign Error:', e);
        throw e;
    }
}

export async function verifyJWT(token: string, secret: string) {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) return null;

        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const signature = base64urlDecode(signatureB64);

        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const isValid = await crypto.subtle.verify('HMAC', key, signature.buffer.slice(0) as ArrayBuffer, data.buffer.slice(0) as ArrayBuffer);
        if (!isValid) return null;

        // Decode payload (must use TextDecoder to handle UTF-8 names with accents)
        const payloadBytes = base64urlDecode(payloadB64);
        const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

        // Check expiration
        if (payload.exp && Date.now() >= payload.exp * 1000) return null;

        return { payload };
    } catch (e) {
        console.error('Edge JWT Verify Error:', e);
        return null;
    }
}
