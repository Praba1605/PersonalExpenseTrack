import { ChangeDetectorRef, Component, OnDestroy, ViewChild } from '@angular/core';
import { ExpenseForm } from './components/expense-form/expense-form';
import { ExpenseList } from './components/expense-list/expense-list';
import { ExpenseSummary } from './components/expense-summary/expense-summary';
import { VideoCall } from './components/video-call/video-call';
import { Expense } from './models/expense.model';
import { PeerSessionService } from './services/peer-session.service';
import { copyToClipboard } from './utils/clipboard';

type View = 'expenses' | 'video';

@Component({
  selector: 'app-root',
  imports: [ExpenseForm, ExpenseList, ExpenseSummary, VideoCall],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  @ViewChild(ExpenseList) expenseList!: ExpenseList;

  activeTab: View = 'expenses';
  editingExpense: Expense | null = null;
  allExpenses: Expense[] = [];

  /** Peer ID from a "/call/<id>" invite link -- handed to the call component to dial. */
  autoConnectId = '';

  /** Tells the call component to go on the air after we hand out an invite. */
  hostingCall = false;

  linkCopied = false;
  inviteError = '';

  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private cdr: ChangeDetectorRef,
    private peerSession: PeerSessionService,
  ) {
    // Opening someone's "/call/<id>" link should drop you straight into their
    // call, so read the ID up front and show the call view instead of expenses.
    const invitedId = this.peerSession.peerIdFromLink(window.location.pathname);
    if (invitedId) {
      this.autoConnectId = invitedId;
      this.activeTab = 'video';

      // Drop it from the bar once read: the ID belongs to this visit, and
      // leaving it there would re-dial an ended call on every refresh.
      window.history.replaceState({}, '', '/');
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
  }

  /**
   * Copies our direct-join link. Registering with the broker comes first
   * because the link has to carry a real ID, and it runs before anything slow
   * so the click still counts as the user gesture the clipboard requires.
   */
  async copyInviteLink(): Promise<void> {
    this.inviteError = '';

    try {
      await this.peerSession.connect();
      await copyToClipboard(this.peerSession.inviteLink());
    } catch {
      this.inviteError = 'Could not create your call link. Please try again.';
      this.cdr.markForCheck();
      return;
    }

    this.linkCopied = true;

    // Handing out the link is only half of it -- we also have to be in the
    // call, or the invitee dials an ID with nothing listening behind it.
    this.hostingCall = true;
    this.activeTab = 'video';
    this.cdr.markForCheck();

    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.linkCopied = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  /**
   * Hanging up is the only exit from the call view now that the tab strip is
   * gone, so it drops us back to the expenses page and clears the invite --
   * re-entering should be a fresh visit, not a second automatic dial.
   */
  onCallEnded(): void {
    this.activeTab = 'expenses';
    this.autoConnectId = '';
    this.hostingCall = false;
    this.cdr.markForCheck();
  }

  onExpensesLoaded(expenses: Expense[]): void {
    this.allExpenses = expenses;
  }

  onEdit(expense: Expense): void {
    this.editingExpense = expense;
  }

  onSaved(): void {
    this.editingExpense = null;
    this.expenseList.refresh();
  }

  onCancelled(): void {
    this.editingExpense = null;
  }
}
