import { Injectable } from '@angular/core';

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72';

/**
 * A Twemoji filename: lowercase hex codepoints joined by hyphens. Incoming
 * sticker ids are checked against this shape rather than against the list
 * below, so an id from a build with a different set still renders -- while
 * still making it impossible to point the <img> anywhere but the CDN.
 */
const CODEPOINT_ID = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,6}$/;

export interface Emoji {
  /** Twemoji codepoint id, e.g. "1f600". This is what travels over the wire. */
  id: string;
  label: string;
}

/**
 * A deliberately small, common set shown as a single grid. Every id is checked
 * against the Twemoji 15.1.0 asset list, so none of these render broken.
 */
export const EMOJIS: readonly Emoji[] = [
  { id: '1f44d', label: 'thumbs up' },
  { id: '1f44e', label: 'thumbs down' },
  { id: '1f44f', label: 'clapping hands' },
  { id: '1f64f', label: 'folded hands' },
  { id: '1f44b', label: 'waving hand' },
  { id: '1f91d', label: 'handshake' },
  { id: '1f44c', label: 'OK hand' },
  { id: '1f4aa', label: 'flexed biceps' },
  { id: '1f600', label: 'grinning face' },
  { id: '1f603', label: 'grinning face with big eyes' },
  { id: '1f604', label: 'grinning face with smiling eyes' },
  { id: '1f601', label: 'beaming face with smiling eyes' },
  { id: '1f605', label: 'grinning face with sweat' },
  { id: '1f602', label: 'face with tears of joy' },
  { id: '1f923', label: 'rolling on the floor laughing' },
  { id: '1f642', label: 'slightly smiling face' },
  { id: '1f609', label: 'winking face' },
  { id: '1f60a', label: 'smiling face with smiling eyes' },
  { id: '1f60d', label: 'smiling face with heart-eyes' },
  { id: '1f618', label: 'face blowing a kiss' },
  { id: '1f61c', label: 'winking face with tongue' },
  { id: '1f914', label: 'thinking face' },
  { id: '1f610', label: 'neutral face' },
  { id: '1f62c', label: 'grimacing face' },
  { id: '1f644', label: 'face with rolling eyes' },
  { id: '1f60e', label: 'smiling face with sunglasses' },
  { id: '1f973', label: 'partying face' },
  { id: '1f622', label: 'crying face' },
  { id: '1f62d', label: 'loudly crying face' },
  { id: '1f621', label: 'enraged face' },
  { id: '1f631', label: 'face screaming in fear' },
  { id: '1f62e', label: 'face with open mouth' },
  { id: '1f92f', label: 'exploding head' },
  { id: '1f917', label: 'smiling face with open hands' },
  { id: '1f634', label: 'sleeping face' },
  { id: '1f971', label: 'yawning face' },
  { id: '2764', label: 'red heart' },
  { id: '1f494', label: 'broken heart' },
  { id: '2728', label: 'sparkles' },
  { id: '2b50', label: 'star' },
  { id: '1f525', label: 'fire' },
  { id: '1f4af', label: 'hundred points' },
  { id: '2705', label: 'check mark button' },
  { id: '274c', label: 'cross mark' },
  { id: '26a0', label: 'warning' },
  { id: '2753', label: 'red question mark' },
  { id: '2757', label: 'red exclamation mark' },
  { id: '1f4a1', label: 'light bulb' },
  { id: '1f389', label: 'party popper' },
  { id: '1f38a', label: 'confetti ball' },
  { id: '1f680', label: 'rocket' },
  { id: '2615', label: 'hot beverage' },
  { id: '1f355', label: 'pizza' },
  { id: '1f382', label: 'birthday cake' },
  { id: '1f3c6', label: 'trophy' },
  { id: '1f440', label: 'eyes' },
];

const LABELS = new Map(EMOJIS.map((emoji) => [emoji.id, emoji.label]));

@Injectable({ providedIn: 'root' })
export class EmojiService {
  readonly emojis = EMOJIS;

  imageUrl(id: string): string {
    return `${TWEMOJI_BASE}/${id}.png`;
  }

  isValidId(id: string): boolean {
    return CODEPOINT_ID.test(id);
  }

  /** Falls back to a generic name for an id outside our own set. */
  labelFor(id: string): string {
    return LABELS.get(id) ?? 'emoji';
  }
}
