import { Injectable } from '@angular/core';
import Peer from 'peerjs';

/** The path an invite link uses: <origin>/call/<peer id>. */
const INVITE_PATH = '/call/';

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
  connect(): Promise<Peer> {
    if (this.peer && !this.peer.destroyed) {
      return Promise.resolve(this.peer);
    }

    if (this.pending) {
      return this.pending;
    }

    this.pending = new Promise<Peer>((resolve, reject) => {
      // No arguments = PeerJS's free hosted broker, which assigns a random ID.
      const peer = new Peer();

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
    const marker = link.indexOf(INVITE_PATH);
    if (marker === -1) {
      return '';
    }

    // Everything after "/call/" is the ID, minus anything the browser or the
    // person pasting may have carried along with it.
    const tail = link.slice(marker + INVITE_PATH.length).split(/[?#]/)[0];
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
