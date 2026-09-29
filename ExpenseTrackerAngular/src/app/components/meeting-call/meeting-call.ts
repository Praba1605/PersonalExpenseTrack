import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VideoCall } from '../video-call/video-call';
import { PeerSessionService } from '../../services/peer-session.service';
import { EmojiService } from '../../services/emoji.service';

/**
 * The Google Meet styled call surface.
 *
 * It extends VideoCall rather than reimplementing it: every bit of the media,
 * chat, sticker and two-person logic is inherited, and only the template and
 * styles differ. That leaves the original /call/ screen exactly as it was.
 */
@Component({
  selector: 'app-meeting-call',
  imports: [FormsModule],
  templateUrl: './meeting-call.html',
  styleUrl: './meeting-call.css',
})
export class MeetingCall extends VideoCall {
  /** The human-facing code, shown bottom-left. Never the prefixed peer ID. */
  @Input() displayCode = '';

  constructor(cdr: ChangeDetectorRef, peerSession: PeerSessionService, emojiService: EmojiService) {
    super(cdr, peerSession, emojiService);
  }

  /** As a guest, the only other person in the room is the host who made it. */
  get remoteIsHost(): boolean {
    return this.mode === 'meeting-guest';
  }

  /** Falls back to the old wording if no name was supplied. */
  get selfLabel(): string {
    return this.displayName || 'You';
  }

  /** '' until their name frame arrives, so the tile is never blank. */
  get remoteLabel(): string {
    return this.remoteName || 'Them';
  }

  /** Presentation only -- who sent a message is already known, this just says so. */
  isHostMessage(message: { fromMe: boolean }): boolean {
    return message.fromMe ? this.isHost : this.remoteIsHost;
  }
}
