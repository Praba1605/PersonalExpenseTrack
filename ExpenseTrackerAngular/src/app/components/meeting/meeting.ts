import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MeetingCall } from '../meeting-call/meeting-call';
import { PeerSessionService } from '../../services/peer-session.service';
import { copyToClipboard } from '../../utils/clipboard';
import { CALL_MEDIA_CONSTRAINTS } from '../../utils/media';

type MeetingState = 'landing' | 'creating' | 'preview' | 'in-call' | 'full' | 'ended' | 'error';
type Role = 'host' | 'guest';

@Component({
  selector: 'app-meeting',
  imports: [FormsModule, MeetingCall],
  templateUrl: './meeting.html',
  styleUrl: './meeting.css',
})
export class Meeting implements OnInit, OnDestroy {
  /** Room code from a "/meeting/<code>" link, when we arrived as a guest. */
  @Input() joinCode = '';

  state: MeetingState = 'landing';
  role: Role = 'host';
  roomCode = '';
  joinInput = '';
  error = '';
  joinError = '';
  linkCopied = false;

  @ViewChild('previewVideo') previewVideoRef?: ElementRef<HTMLVideoElement>;

  private previewStream?: MediaStream;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private cdr: ChangeDetectorRef,
    private peerSession: PeerSessionService,
  ) {}

  ngOnInit(): void {
    const code = this.peerSession.normalizeRoomCode(this.joinCode);
    if (code) {
      this.roomCode = code;
      this.role = 'guest';
      void this.enterPreview();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
    this.stopPreview();
  }

  get meetingLink(): string {
    return this.roomCode ? this.peerSession.meetingLink(this.roomCode) : '';
  }

  /** The prefixed PeerJS ID a guest dials. Never shown. */
  get hostPeerId(): string {
    return this.roomCode ? this.peerSession.peerIdForRoom(this.roomCode) : '';
  }

  /**
   * Reserves the code up front so that by the time the call screen asks the
   * service for a peer, the meeting ID is already registered to us.
   */
  async newMeeting(): Promise<void> {
    this.state = 'creating';
    this.error = '';
    this.cdr.markForCheck();

    try {
      const { code } = await this.peerSession.connectAsRoom();
      this.roomCode = code;
      this.role = 'host';
      await this.enterPreview();
    } catch {
      this.error = 'Could not start the meeting. Please try again.';
      this.state = 'error';
      this.cdr.markForCheck();
    }
  }

  joinWithCode(): void {
    const code = this.peerSession.normalizeRoomCode(this.joinInput);
    if (!code) {
      this.joinError = 'Enter a code like abc-defg-hij, or paste a meeting link.';
      this.cdr.markForCheck();
      return;
    }

    this.joinError = '';
    this.roomCode = code;
    this.role = 'guest';
    void this.enterPreview();
  }

  /** Shows your own camera before anyone else can see it. */
  private async enterPreview(): Promise<void> {
    this.state = 'preview';
    this.error = '';
    this.cdr.detectChanges();

    try {
      this.previewStream = await navigator.mediaDevices.getUserMedia(CALL_MEDIA_CONSTRAINTS);
    } catch {
      // Not fatal: the call screen asks again and reports it properly there.
      this.error = 'Could not access your camera or microphone.';
      this.cdr.markForCheck();
      return;
    }

    if (this.previewVideoRef) {
      this.previewVideoRef.nativeElement.srcObject = this.previewStream;
    }
    this.cdr.markForCheck();
  }

  joinNow(): void {
    // Release the preview camera before the call screen opens its own.
    this.stopPreview();
    this.state = 'in-call';
    this.cdr.markForCheck();
  }

  async copyLink(): Promise<void> {
    const link = this.meetingLink;
    if (!link) {
      return;
    }

    try {
      await copyToClipboard(link);
    } catch {
      this.error = 'Could not copy the link. Select it and copy manually.';
      this.cdr.markForCheck();
      return;
    }

    this.error = '';
    this.linkCopied = true;
    this.cdr.markForCheck();

    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.linkCopied = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  onRoomFull(): void {
    this.state = 'full';
    this.cdr.markForCheck();
  }

  onEnded(): void {
    this.state = 'ended';
    this.connectedNow = false;
    this.cdr.markForCheck();
  }

  connectedNow = false;

  onStatusChange(status: 'idle' | 'ready' | 'connected'): void {
    this.connectedNow = status === 'connected';
    this.cdr.markForCheck();
  }

  backToLanding(): void {
    this.stopPreview();
    this.state = 'landing';
    this.roomCode = '';
    this.joinInput = '';
    this.error = '';
    this.joinError = '';
    this.linkCopied = false;
    this.connectedNow = false;
    this.cdr.markForCheck();
  }

  private stopPreview(): void {
    this.previewStream?.getTracks().forEach((track) => track.stop());
    this.previewStream = undefined;

    if (this.previewVideoRef) {
      this.previewVideoRef.nativeElement.srcObject = null;
    }
  }
}
