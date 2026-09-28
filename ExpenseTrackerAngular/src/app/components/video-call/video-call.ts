import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { PeerSessionService } from '../../services/peer-session.service';
import { CALL_MEDIA_CONSTRAINTS } from '../../utils/media';
import { Emoji, EMOJIS, EmojiService } from '../../services/emoji.service';

type Status = 'idle' | 'ready' | 'connected';

/**
 * Chat now carries two kinds of message, so a discriminated union keeps the
 * template honest: a sticker has no text and a text message has no sticker.
 */
type ChatMessage =
  | { fromMe: boolean; kind: 'text'; text: string }
  | { fromMe: boolean; kind: 'sticker'; stickerId: string; label: string };

/** What actually crosses the data channel. */
type ChatPayload =
  | { kind: 'text'; text: string }
  | { kind: 'sticker'; id: string }
  /** Control frame: the host telling a third party the room is taken. */
  | { kind: 'full' }
  /** Announces our own microphone state so the other side can show it. */
  | { kind: 'mic'; muted: boolean }
  /** The host asking us to mute or unmute. Only honoured when it comes from
   *  the host -- see acceptsHostCommands. */
  | { kind: 'mute-request' }
  | { kind: 'unmute-request' };

/**
 * 'direct' is the original /call/<id> behaviour, left untouched. The meeting
 * modes add a two-person limit and a host that may not be online yet.
 */
export type CallMode = 'direct' | 'meeting-host' | 'meeting-guest';

@Component({
  selector: 'app-video-call',
  imports: [FormsModule],
  templateUrl: './video-call.html',
  styleUrl: './video-call.css',
})
export class VideoCall implements OnInit, OnChanges, OnDestroy {
  /** Peer ID pulled from a "/call/<id>" invite link, if we arrived through one. */
  @Input() autoConnectId = '';

  /** Set by the header invite button: go on the air so the invitee can land. */
  @Input() autoStart = false;

  @Input() mode: CallMode = 'direct';

  /** Hanging up is the way back to the expenses view. */
  @Output() ended = new EventEmitter<void>();

  /** Lets a meeting wrapper swap its banner without duplicating this state. */
  @Output() statusChange = new EventEmitter<Status>();

  /** The host turned us away because someone else is already in the room. */
  @Output() roomFull = new EventEmitter<void>();

  /** The room code is not registered yet -- the host has not started. */
  @Output() hostUnavailable = new EventEmitter<void>();

  status: Status = 'idle';
  error = '';
  myPeerId = '';
  remotePeerId = '';
  micEnabled = true;
  /** The other person's mic, learned from their announcements. */
  remoteMuted = false;
  /** Whether we have heard from them yet; before that we show nothing. */
  remoteMicKnown = false;
  /** A microphone exists and we were granted it. */
  micAvailable = true;
  micPermission: PermissionState | 'unknown' = 'unknown';
  hostMenuOpen = false;
  hostNotice = '';
  cameraEnabled = true;
  screenSharing = false;
  chatReady = false;
  chatDraft = '';
  chatMessages: ChatMessage[] = [];
  chatOpen = false;
  unreadCount = 0;
  stickerPanelOpen = false;
  readonly emojis = EMOJIS;

  /**
   * Chrome and Safari on mobile do not implement getDisplayMedia at all --
   * there is no window picker on a phone -- so the control is disabled rather
   * than left looking available and doing nothing.
   */
  readonly screenShareSupported =
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  // Not static: the tiles only exist once we leave the idle state, so these
  // resolve on the change detection pass that renders them.
  @ViewChild('localVideo') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('messageList') messageListRef?: ElementRef<HTMLElement>;

  private peer?: Peer;
  private localStream?: MediaStream;
  private screenStream?: MediaStream;
  private activeCall?: MediaConnection;
  private dataConn?: DataConnection;
  private autoCallId = '';
  /** Remote peer we are paired with; a meeting admits exactly one. */
  private partnerId?: string;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private starting = false;
  private listeningOn?: Peer;

  constructor(
    private cdr: ChangeDetectorRef,
    private peerSession: PeerSessionService,
    private emojiService: EmojiService,
  ) {}

  ngOnInit(): void {
    const id = this.autoConnectId.trim();
    if (id) {
      // We came in through an invite link, so skip the "paste their ID" step:
      // turn the camera on now and dial once our own peer is registered.
      this.autoCallId = id;
      this.remotePeerId = id;
    }

    if (id || this.autoStart) {
      void this.start();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The header's invite button can flip autoStart on while this component is
    // already mounted and idle, which ngOnInit has no chance to catch.
    if (changes['autoStart'] && !changes['autoStart'].firstChange && this.autoStart) {
      void this.start();
    }
  }

  ngOnDestroy(): void {
    // Tear down without emitting: the host is already leaving this view.
    this.teardown();
  }

  async start(): Promise<void> {
    // Guards a second entry from the invite-link path racing the header button.
    if (this.starting || this.status !== 'idle') {
      return;
    }

    this.starting = true;
    this.error = '';

    void this.readMicPermission();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(CALL_MEDIA_CONSTRAINTS);
    } catch (err) {
      this.error = describeMediaError(err);
      this.starting = false;
      this.cdr.markForCheck();
      return;
    }

    // A browser can grant video but no audio, in which case there is no mic to
    // toggle and the control should say so rather than silently doing nothing.
    this.micAvailable = this.localStream.getAudioTracks().length > 0;
    if (!this.micAvailable) {
      this.micEnabled = false;
    }

    // Leave idle first and force the render, otherwise the tiles -- and the
    // video elements these refs point at -- do not exist yet.
    this.setStatus('ready');
    this.cdr.detectChanges();

    if (this.localVideoRef) {
      this.localVideoRef.nativeElement.srcObject = this.localStream;
    }

    // Shared with the header's invite button, so the ID in a copied link is
    // always the one now listening for calls.
    try {
      this.peer = await this.peerSession.connect();
    } catch {
      this.error = 'Could not reach the call service. Please try again.';
      this.starting = false;
      this.cdr.markForCheck();
      return;
    }

    this.myPeerId = this.peer.id;
    this.starting = false;

    // The service hands back the same peer the header button may have already
    // created, so bind once per instance rather than stacking duplicates.
    if (this.listeningOn !== this.peer) {
      this.listeningOn = this.peer;
      this.bindPeerEvents(this.peer);
    }

    // Only dial once the handlers are attached, so the answer from the other
    // side has somewhere to land.
    if (this.autoCallId) {
      this.autoCallId = '';
      this.call();
    }

    this.cdr.markForCheck();
  }

  private bindPeerEvents(peer: Peer): void {
    // Fires when someone else calls US. Answering with our stream is what lets
    // them see/hear us back -- a PeerJS call is two-way from the start.
    peer.on('call', (incomingCall) => {
      if (!this.admits(incomingCall.peer)) {
        incomingCall.close();
        return;
      }

      this.partnerId = incomingCall.peer;
      incomingCall.answer(this.localStream);
      this.attachCall(incomingCall);
    });

    // A DataConnection is PeerJS's other connection type -- a plain text/data
    // channel, separate from the audio/video one, for the chat feature.
    peer.on('connection', (conn) => {
      if (!this.admits(conn.peer)) {
        this.turnAway(conn);
        return;
      }

      this.partnerId = conn.peer;
      this.attachDataConnection(conn);
    });

    peer.on('error', (err) => {
      // A meeting guest routinely arrives before the host has started, which
      // is a "wait" rather than a failure.
      if (err.type === 'peer-unavailable' && this.mode === 'meeting-guest') {
        this.hostUnavailable.emit();
        this.scheduleJoinRetry();
        return;
      }

      this.error = `Connection error: ${err.type}`;
      this.cdr.markForCheck();
    });
  }

  /** A meeting seats two; anyone who is not our partner is turned away. */
  private admits(remoteId: string): boolean {
    if (this.mode === 'direct') {
      return true;
    }

    return !this.partnerId || this.partnerId === remoteId;
  }

  /**
   * Tells the third party why before hanging up on them, so they can show
   * "This meeting is full" rather than a bare disconnect.
   */
  private turnAway(conn: DataConnection): void {
    const sendAndClose = () => {
      conn.send(JSON.stringify({ kind: 'full' } satisfies ChatPayload));
      setTimeout(() => conn.close(), 250);
    };

    if (conn.open) {
      sendAndClose();
    } else {
      conn.once('open', sendAndClose);
    }
  }

  /** The host may still be getting set up, so keep dialling quietly. */
  private scheduleJoinRetry(): void {
    if (this.status === 'connected' || this.retryTimer || !this.remotePeerId) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.status !== 'connected' && this.peer && this.localStream) {
        this.call();
      }
    }, 3000);
  }

  call(): void {
    if (!this.peer || !this.localStream) {
      return;
    }

    // The box takes a whole invite link just as happily as a bare ID.
    const id = this.peerSession.resolvePeerId(this.remotePeerId);
    if (!id) {
      this.error = 'Paste a call link or ID first.';
      this.cdr.markForCheck();
      return;
    }

    // Show what we actually dialled, so a pasted link collapses to the ID.
    this.remotePeerId = id;
    this.partnerId = id;
    this.error = '';
    this.attachCall(this.peer.call(id, this.localStream));
    this.attachDataConnection(this.peer.connect(id));
  }

  sendChatMessage(): void {
    const text = this.chatDraft.trim();
    if (!text || !this.dataConn?.open) {
      return;
    }

    this.send({ kind: 'text', text });
    this.chatMessages = [...this.chatMessages, { fromMe: true, kind: 'text', text }];
    this.chatDraft = '';
    this.scrollChatToLatest();
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;

    if (this.chatOpen) {
      // Opening is the "I have seen these" signal.
      this.unreadCount = 0;
      this.scrollChatToLatest();
    } else {
      this.stickerPanelOpen = false;
    }
  }

  toggleStickerPanel(): void {
    this.stickerPanelOpen = !this.stickerPanelOpen;
  }

  sendSticker(emoji: Emoji): void {
    if (!this.dataConn?.open) {
      return;
    }

    // Only the codepoint id goes out; the other side builds the URL itself.
    this.send({ kind: 'sticker', id: emoji.id });
    this.chatMessages = [
      ...this.chatMessages,
      { fromMe: true, kind: 'sticker', stickerId: emoji.id, label: emoji.label },
    ];
    this.stickerPanelOpen = false;
    this.scrollChatToLatest();
  }

  stickerUrl(id: string): string {
    return this.emojiService.imageUrl(id);
  }

  /** Keeps the newest message in view, after the DOM has caught up. */
  private scrollChatToLatest(): void {
    setTimeout(() => {
      const list = this.messageListRef?.nativeElement;
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    });
  }

  private setStatus(status: Status): void {
    if (this.status !== status) {
      this.status = status;
      this.statusChange.emit(status);
    }
  }

  private send(payload: ChatPayload): void {
    this.dataConn?.send(JSON.stringify(payload));
  }

  toggleMic(): void {
    if (this.micEnabled) {
      this.setMicEnabled(false);
      this.setHostNotice('');
      return;
    }

    this.enableMic('self');
  }

  get isHost(): boolean {
    return this.mode === 'meeting-host';
  }

  /**
   * Only a guest takes mute/unmute orders, and its single partner is by
   * definition the host whose room code it dialled. A host therefore ignores
   * the same frames coming back from a participant.
   */
  private get acceptsHostCommands(): boolean {
    return this.mode === 'meeting-guest';
  }

  toggleHostMenu(): void {
    this.hostMenuOpen = !this.hostMenuOpen;
  }

  muteParticipant(): void {
    this.hostMenuOpen = false;

    if (!this.dataConn?.open || this.remoteMuted) {
      return;
    }

    this.send({ kind: 'mute-request' });
  }

  unmuteParticipant(): void {
    this.hostMenuOpen = false;

    if (!this.dataConn?.open || !this.remoteMuted) {
      return;
    }

    this.send({ kind: 'unmute-request' });
  }

  muteEveryone(): void {
    this.hostMenuOpen = false;

    if (this.micEnabled) {
      this.setMicEnabled(false);
    }

    if (this.dataConn?.open && !this.remoteMuted) {
      this.send({ kind: 'mute-request' });
    }
  }

  unmuteEveryone(): void {
    this.hostMenuOpen = false;

    if (!this.micEnabled) {
      this.enableMic('self');
    }

    if (this.dataConn?.open && this.remoteMuted) {
      this.send({ kind: 'unmute-request' });
    }
  }

  /**
   * The one place a microphone is switched back on, so the permission check
   * cannot be skipped by any caller -- self, host, or "unmute all".
   */
  private enableMic(source: 'self' | 'host'): void {
    if (!this.canEnableMic()) {
      // Stay muted and say why, rather than throwing or silently failing.
      this.micEnabled = false;
      this.setHostNotice('Microphone access is blocked. Allow it in your browser settings.');
      this.announceMic();
      this.cdr.markForCheck();
      return;
    }

    this.setMicEnabled(true);
    this.setHostNotice(source === 'host' ? 'Host unmuted you' : '');
  }

  private canEnableMic(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    return Boolean(
      this.micAvailable && track && track.readyState === 'live' && this.micPermission !== 'denied',
    );
  }

  /** Notices are transient; a stale "Host unmuted you" would be confusing. */
  private setHostNotice(text: string): void {
    clearTimeout(this.noticeTimer);
    this.hostNotice = text;

    if (text) {
      this.noticeTimer = setTimeout(() => {
        this.hostNotice = '';
        this.cdr.markForCheck();
      }, 4000);
    }
  }

  private setMicEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => (track.enabled = enabled));
    this.micEnabled = enabled;
    this.announceMic();
    this.cdr.markForCheck();
  }

  /** Keeps the other side's indicator honest the moment anything changes. */
  private announceMic(): void {
    if (this.dataConn?.open) {
      this.send({ kind: 'mic', muted: !this.micEnabled });
    }
  }

  private async readMicPermission(): Promise<void> {
    try {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      this.micPermission = status.state;
      status.onchange = () => {
        this.micPermission = status.state;
        this.cdr.markForCheck();
      };
    } catch {
      // Firefox and Safari do not expose the microphone permission name.
      this.micPermission = 'unknown';
    }

    this.cdr.markForCheck();
  }

  toggleCamera(): void {
    this.localStream?.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    this.cameraEnabled = !this.cameraEnabled;
  }

  async toggleScreenShare(): Promise<void> {
    if (this.screenSharing) {
      this.stopScreenShare();
      return;
    }

    if (!this.screenShareSupported) {
      this.error = 'Screen sharing is not supported by this browser.';
      this.cdr.markForCheck();
      return;
    }

    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (err) {
      // Dismissing the "choose a window/tab" picker is a normal outcome, not a
      // failure. Anything else is real and used to be swallowed silently.
      if (!isCancellation(err)) {
        this.error = 'Could not start screen sharing. Please try again.';
        this.cdr.markForCheck();
      }
      return;
    }

    this.error = '';

    this.screenStream = screenStream;
    const screenTrack = screenStream.getVideoTracks()[0];

    // A call's RTCPeerConnection already has a video "sender" set up for the
    // camera. Swapping its track sends the screen instead, with no need to
    // hang up and re-call.
    const sender = this.activeCall?.peerConnection
      .getSenders()
      .find((s) => s.track?.kind === 'video');
    await sender?.replaceTrack(screenTrack);

    if (this.localVideoRef) {
      this.localVideoRef.nativeElement.srcObject = screenStream;
    }
    this.screenSharing = true;

    // Also react if the user stops sharing via the browser's own "Stop
    // sharing" bar, not just our button.
    screenTrack.onended = () => this.stopScreenShare();

    this.cdr.markForCheck();
  }

  private stopScreenShare(): void {
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = undefined;
    this.screenSharing = false;

    const cameraTrack = this.localStream?.getVideoTracks()[0];
    const sender = this.activeCall?.peerConnection
      .getSenders()
      .find((s) => s.track?.kind === 'video');
    if (cameraTrack) {
      sender?.replaceTrack(cameraTrack);
    }

    if (this.localStream && this.localVideoRef) {
      this.localVideoRef.nativeElement.srcObject = this.localStream;
    }

    this.cdr.markForCheck();
  }

  hangUp(): void {
    this.teardown();
    this.ended.emit();
  }

  private teardown(): void {
    this.activeCall?.close();
    this.activeCall = undefined;

    this.dataConn?.close();
    this.dataConn = undefined;

    if (this.remoteVideoRef) {
      this.remoteVideoRef.nativeElement.srcObject = null;
    }

    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenStream = undefined;

    // Closing the call only ends that connection -- it doesn't turn the camera
    // off. Stopping every track is what actually releases the camera/mic.
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = undefined;
    if (this.localVideoRef) {
      this.localVideoRef.nativeElement.srcObject = null;
    }

    this.peerSession.destroy();
    this.peer = undefined;
    this.listeningOn = undefined;
    this.starting = false;

    this.myPeerId = '';
    this.remotePeerId = '';
    this.micEnabled = true;
    this.remoteMuted = false;
    this.remoteMicKnown = false;
    this.micAvailable = true;
    this.hostMenuOpen = false;
    this.hostNotice = '';
    this.cameraEnabled = true;
    this.screenSharing = false;
    this.chatReady = false;
    this.chatDraft = '';
    this.chatMessages = [];
    this.stickerPanelOpen = false;
    this.chatOpen = false;
    this.unreadCount = 0;
    this.partnerId = undefined;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    clearTimeout(this.noticeTimer);
    this.setStatus('idle');
    this.cdr.markForCheck();
  }

  private attachDataConnection(conn: DataConnection): void {
    this.dataConn = conn;

    conn.on('open', () => {
      this.chatReady = true;
      // Exchange mic state immediately, otherwise each side shows the other as
      // unmuted until they happen to toggle.
      this.announceMic();
      this.cdr.markForCheck();
    });

    conn.on('data', (data) => {
      if (this.handleControlFrame(data)) {
        return;
      }

      const message = this.parseIncoming(data);
      if (!message) {
        return;
      }

      this.chatMessages = [...this.chatMessages, message];

      if (this.chatOpen) {
        this.scrollChatToLatest();
      } else {
        this.unreadCount += 1;
      }

      this.cdr.markForCheck();
    });

    conn.on('close', () => {
      this.chatReady = false;
      this.dataConn = undefined;
      this.cdr.markForCheck();
    });
  }

  /**
   * Intercepts the non-chat frames. Returns true when the payload was one of
   * them, so the caller does not also try to render it as a message.
   */
  private handleControlFrame(data: unknown): boolean {
    let payload: Partial<ChatPayload>;
    try {
      payload = JSON.parse(String(data)) as Partial<ChatPayload>;
    } catch {
      return false;
    }

    switch (payload?.kind) {
      case 'full':
        this.roomFull.emit();
        this.teardown();
        this.cdr.markForCheck();
        return true;

      case 'mic':
        this.remoteMuted = Boolean((payload as { muted?: boolean }).muted);
        this.remoteMicKnown = true;
        this.cdr.markForCheck();
        return true;

      case 'mute-request':
        // Dropped unless it came from the host.
        if (this.acceptsHostCommands && this.micEnabled) {
          this.setMicEnabled(false);
          this.setHostNotice('You were muted by the host');
          this.cdr.markForCheck();
        }
        return true;

      case 'unmute-request':
        if (this.acceptsHostCommands && !this.micEnabled) {
          this.enableMic('host');
          this.cdr.markForCheck();
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Turns whatever arrived on the data channel into a message, or null if it
   * is not something we are willing to render.
   */
  private parseIncoming(data: unknown): ChatMessage | null {
    const raw = String(data);

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      // Older builds sent bare strings, so treat anything unparseable as text
      // rather than dropping the message.
      return raw ? { fromMe: false, kind: 'text', text: raw } : null;
    }

    if (typeof payload !== 'object' || payload === null || !('kind' in payload)) {
      return raw ? { fromMe: false, kind: 'text', text: raw } : null;
    }

    const message = payload as Partial<ChatPayload>;

    if (message.kind === 'sticker') {
      // Only a codepoint id is accepted, never a URL -- otherwise the peer
      // could point our <img> at any address they liked.
      const id = typeof message.id === 'string' ? message.id : '';
      return this.emojiService.isValidId(id)
        ? { fromMe: false, kind: 'sticker', stickerId: id, label: this.emojiService.labelFor(id) }
        : null;
    }

    if (message.kind === 'text' && typeof message.text === 'string' && message.text) {
      return { fromMe: false, kind: 'text', text: message.text };
    }

    return null;
  }

  private attachCall(call: MediaConnection): void {
    this.activeCall = call;

    call.on('stream', (remoteStream) => {
      if (this.remoteVideoRef) {
        this.remoteVideoRef.nativeElement.srcObject = remoteStream;
      }
      this.setStatus('connected');
      this.cdr.markForCheck();
    });

    call.on('close', () => {
      if (this.remoteVideoRef) {
        this.remoteVideoRef.nativeElement.srcObject = null;
      }
      this.setStatus('ready');
      this.cdr.markForCheck();
    });
  }
}

/** The two DOMException names browsers use when the user waves the picker away. */
function isCancellation(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

/** Turns a getUserMedia rejection into something a person can act on. */
function describeMediaError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera and microphone access is blocked. Allow it from the icon in your browser address bar, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is already in use by another app.';
    default:
      return 'Could not access your camera or microphone.';
  }
}
