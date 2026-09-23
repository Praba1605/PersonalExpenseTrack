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

type Status = 'idle' | 'ready' | 'connected';

interface ChatMessage {
  fromMe: boolean;
  text: string;
}

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

  /** Hanging up is the way back to the expenses view. */
  @Output() ended = new EventEmitter<void>();

  status: Status = 'idle';
  error = '';
  myPeerId = '';
  remotePeerId = '';
  micEnabled = true;
  cameraEnabled = true;
  screenSharing = false;
  chatReady = false;
  chatDraft = '';
  chatMessages: ChatMessage[] = [];

  // Not static: the tiles only exist once we leave the idle state, so these
  // resolve on the change detection pass that renders them.
  @ViewChild('localVideo') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef?: ElementRef<HTMLVideoElement>;

  private peer?: Peer;
  private localStream?: MediaStream;
  private screenStream?: MediaStream;
  private activeCall?: MediaConnection;
  private dataConn?: DataConnection;
  private autoCallId = '';
  private starting = false;
  private listeningOn?: Peer;

  constructor(
    private cdr: ChangeDetectorRef,
    private peerSession: PeerSessionService,
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

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      this.error = 'Could not access your camera or microphone.';
      this.starting = false;
      this.cdr.markForCheck();
      return;
    }

    // Leave idle first and force the render, otherwise the tiles -- and the
    // video elements these refs point at -- do not exist yet.
    this.status = 'ready';
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
      incomingCall.answer(this.localStream);
      this.attachCall(incomingCall);
    });

    // A DataConnection is PeerJS's other connection type -- a plain text/data
    // channel, separate from the audio/video one, for the chat feature.
    peer.on('connection', (conn) => this.attachDataConnection(conn));

    peer.on('error', (err) => {
      this.error = `Connection error: ${err.type}`;
      this.cdr.markForCheck();
    });
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
    this.error = '';
    this.attachCall(this.peer.call(id, this.localStream));
    this.attachDataConnection(this.peer.connect(id));
  }

  sendChatMessage(): void {
    const text = this.chatDraft.trim();
    if (!text || !this.dataConn?.open) {
      return;
    }

    this.dataConn.send(text);
    this.chatMessages = [...this.chatMessages, { fromMe: true, text }];
    this.chatDraft = '';
  }

  toggleMic(): void {
    this.localStream?.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    this.micEnabled = !this.micEnabled;
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

    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch {
      // User cancelled the "choose a window/tab" picker -- not an error.
      return;
    }

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
    this.cameraEnabled = true;
    this.screenSharing = false;
    this.chatReady = false;
    this.chatDraft = '';
    this.chatMessages = [];
    this.status = 'idle';
    this.cdr.markForCheck();
  }

  private attachDataConnection(conn: DataConnection): void {
    this.dataConn = conn;

    conn.on('open', () => {
      this.chatReady = true;
      this.cdr.markForCheck();
    });

    conn.on('data', (data) => {
      this.chatMessages = [...this.chatMessages, { fromMe: false, text: String(data) }];
      this.cdr.markForCheck();
    });

    conn.on('close', () => {
      this.chatReady = false;
      this.dataConn = undefined;
      this.cdr.markForCheck();
    });
  }

  private attachCall(call: MediaConnection): void {
    this.activeCall = call;

    call.on('stream', (remoteStream) => {
      if (this.remoteVideoRef) {
        this.remoteVideoRef.nativeElement.srcObject = remoteStream;
      }
      this.status = 'connected';
      this.cdr.markForCheck();
    });

    call.on('close', () => {
      if (this.remoteVideoRef) {
        this.remoteVideoRef.nativeElement.srcObject = null;
      }
      this.status = 'ready';
      this.cdr.markForCheck();
    });
  }
}
