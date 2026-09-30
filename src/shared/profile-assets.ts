import { MAX_PROFILE_IMAGE_BYTES } from './profiles';
export function validateProfileImage(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || match[2].length > Math.ceil(MAX_PROFILE_IMAGE_BYTES * 4 / 3) + 4) throw new Error('Choose a PNG, JPEG, WebP or GIF image up to 10 MB.');
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  const signature = [...bytes.slice(0, 12)];
  const valid = match[1] === 'image/png' ? signature.slice(0, 8).join() === '137,80,78,71,13,10,26,10' : match[1] === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255 : match[1] === 'image/gif' ? String.fromCharCode(...signature.slice(0, 6)).match(/^GIF8[79]a$/) : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
  if (!valid || bytes.length > MAX_PROFILE_IMAGE_BYTES) throw new Error('The image data does not match its format.');
  return { mime: match[1], bytes };
}
