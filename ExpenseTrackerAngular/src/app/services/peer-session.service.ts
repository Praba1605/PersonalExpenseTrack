import { Injectable } from '@angular/core';
import Peer from 'peerjs';

/** The path a direct invite link uses: <origin>/call/<peer id>. */
const INVITE_PATH = '/call/';

/** The path a meeting link uses: <origin>/meeting/<room code>. */
const MEETING_PATH = '/meeting/';

/**
 * Google Meet style: three groups of lowercase letters, e.g. kqz-mfhw-rte.
 * This is the only form ever shown to a person.
 */
const ROOM_GROUPS = [3, 4, 3];
const ROOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const ROOM_CODE_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/**
 * Namespaces the PeerJS registration so meeting codes cannot collide with the
 * random IDs used by /call/ links. Never shown in the UI.
 */
const PEER_ID_PREFIX = 'etmeet-';

/** PeerJS reports a clashing peer ID with this error type. */
const ID_TAKEN = 'unavailable-id';

function isIdTaken(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === ID_TAKEN;
}

/** A fresh human-facing code in the form xxx-xxxx-xxx. */
export function makeRoomCode(): string {
  const total = ROOM_GROUPS.reduce((sum, n) => sum + n, 0);
  const bytes = new Uint32Array(total);
  crypto.getRandomValues(bytes);

  let at = 0;
  return ROOM_GROUPS.map((size) =>
    Array.from({ length: size }, () => ROOM_ALPHABET[bytes[at++] % ROOM_ALPHABET.length]).join(''),
  ).join('-');
}

export function isRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}

/**
 * Owns the one PeerJS connection the app uses.
 *
 * The header's invite button and the call screen both need it: the header has
 * to know our ID before the camera is ever switched on, and whoever opens the
 * link dials exactly that ID. If those two were separate peers, the link would
 * point at an ID that nothing is listening on and the call would never land.
 */
@Injectable({ providedIn: 'root' })
export class PeerSessionService {
  private peer?: Peer;
  private pending?: Promise<Peer>;

  /** Our broker-assigned ID, or '' while no peer is registered. */
  get id(): string {
    return this.peer && !this.peer.destroyed ? this.peer.id : '';
  }

  /**
   * Registers with the broker on first call and reuses that peer afterwards.
   * Resolves only once an ID has been assigned -- a peer cannot place or
   * receive calls before then.
   */
  connect(preferredId?: string): Promise<Peer> {
    const live = this.peer && !this.peer.destroyed ? this.peer : undefined;

    if (live && (!preferredId || live.id === preferredId)) {
      return Promise.resolve(live);
    }

    // One Peer holds exactly one ID, so registering under a meeting code means
    // letting go of whatever random ID we were assigned before.
    if (live && preferredId) {
      this.destroy();
    }

    if (this.pending && !preferredId) {
      return this.pending;
    }

    this.pending = new Promise<Peer>((resolve, reject) => {
      // With no ID, PeerJS's free hosted broker assigns a random one; with an
      // ID, it reserves that one or fails with "unavailable-id".
      const peer = preferredId ? new Peer(preferredId) : new Peer();

      const onOpen = () => {
        // Drop the startup error handler, otherwise a routine later failure
        // (dialling an ID that has gone away) would tear the whole peer down.
        peer.off('error', onFailure);
        this.peer = peer;
        this.pending = undefined;
        resolve(peer);
      };

      const onFailure = (err: Error) => {
        peer.off('open', onOpen);
        peer.destroy();
        this.pending = undefined;
        reject(err);
      };

      peer.once('open', onOpen);
      peer.once('error', onFailure);
    });

    return this.pending;
  }

  /**
   * Reserves a fresh meeting code. A clash just means someone else got there
   * first, so we roll another code rather than surfacing an error.
   */
  async connectAsRoom(attempts = 5): Promise<{ peer: Peer; code: string }> {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const code = makeRoomCode();
      try {
        return { peer: await this.connect(this.peerIdForRoom(code)), code };
      } catch (err) {
        lastError = err;
        if (!isIdTaken(err)) {
          throw err;
        }
      }
    }

    throw lastError ?? new Error('Could not reserve a meeting code.');
  }

  /** The internal PeerJS ID behind a meeting code. Never shown to a person. */
  peerIdForRoom(code: string): string {
    return `${PEER_ID_PREFIX}${code}`;
  }

  /**
   * Accepts whatever someone pastes into the join box -- a bare code or the
   * whole meeting link -- and returns the code, or '' if it is not one.
   */
  normalizeRoomCode(value: string): string {
    const trimmed = value.trim().toLowerCase();
    const candidate = trimmed.includes(MEETING_PATH) ? this.roomCodeFromLink(trimmed) : trimmed;
    return isRoomCode(candidate) ? candidate : '';
  }

  /** The shareable link for a meeting room. */
  meetingLink(code: string): string {
    return `${window.location.origin}${MEETING_PATH}${encodeURIComponent(code)}`;
  }

  /** Pulls the room code out of a "/meeting/<code>" path, or '' if not one. */
  roomCodeFromLink(link: string): string {
    return this.segmentAfter(link, MEETING_PATH);
  }

  /** The direct-join link for our current ID, or '' if we have no ID yet. */
  inviteLink(): string {
    const id = this.id;
    return id ? `${window.location.origin}${INVITE_PATH}${encodeURIComponent(id)}` : '';
  }

  /**
   * Pulls the peer ID out of an invite link or path, or '' when the value is
   * not one. Deliberately strict, so a plain route like "/" is not mistaken
   * for an ID.
   */
  peerIdFromLink(link: string): string {
    return this.segmentAfter(link, INVITE_PATH);
  }

  /**
   * Everything after the marker path, minus anything the browser or the person
   * pasting may have carried along with it.
   */
  private segmentAfter(link: string, marker: string): string {
    const at = link.indexOf(marker);
    if (at === -1) {
      return '';
    }

    const tail = link.slice(at + marker.length).split(/[?#]/)[0];
    return this.decode(tail.replace(/\/+$/, '')).trim();
  }

  /**
   * Normalises whatever was typed into the "call" box: people paste the whole
   * invite link as often as they paste the bare ID, and both should dial.
   */
  resolvePeerId(value: string): string {
    const trimmed = value.trim();
    return trimmed.includes(INVITE_PATH) ? this.peerIdFromLink(trimmed) : trimmed;
  }

  /** decodeURIComponent throws on malformed escapes; fall back to the raw text. */
  private decode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  destroy(): void {
    this.peer?.destroy();
    this.peer = undefined;
    this.pending = undefined;
  }
}
