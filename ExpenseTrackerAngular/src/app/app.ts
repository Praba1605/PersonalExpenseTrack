import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { ExpenseForm } from './components/expense-form/expense-form';
import { ExpenseList } from './components/expense-list/expense-list';
import { ExpenseSummary } from './components/expense-summary/expense-summary';
import { VideoCall } from './components/video-call/video-call';
import { Meeting } from './components/meeting/meeting';
import { Expense } from './models/expense.model';
import { PeerSessionService } from './services/peer-session.service';

type Tab = 'expenses' | 'meeting';

@Component({
  selector: 'app-root',
  imports: [ExpenseForm, ExpenseList, ExpenseSummary, VideoCall, Meeting],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild(ExpenseList) expenseList!: ExpenseList;

  activeTab: Tab = 'expenses';

  /**
   * The /call/<id> screen is not a tab -- it replaces the tab content while a
   * direct invite call is running, then hands back to Expenses.
   */
  directCall = false;

  /** Room code from a "/meeting/<code>" link. */
  meetingJoinCode = '';
  editingExpense: Expense | null = null;
  allExpenses: Expense[] = [];

  /** Peer ID from a "/call/<id>" invite link -- handed to the call component to dial. */
  autoConnectId = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private peerSession: PeerSessionService,
  ) {
    // Opening someone's "/call/<id>" link should drop you straight into their
    // call, so read the code up front and show that view instead of expenses.
    const path = window.location.pathname;
    const invitedId = this.peerSession.peerIdFromLink(path);
    const roomCode = this.peerSession.roomCodeFromLink(path);

    if (invitedId) {
      this.autoConnectId = invitedId;
      this.directCall = true;
    } else if (roomCode) {
      this.meetingJoinCode = roomCode;
      this.activeTab = 'meeting';
    }

    // Drop it from the bar once read: the code belongs to this visit, and
    // leaving it there would re-dial an ended call on every refresh.
    if (invitedId || roomCode) {
      window.history.replaceState({}, '', '/');
    }
  }

  selectTab(tab: Tab): void {
    this.activeTab = tab;

    // Switching tabs leaves any direct invite call behind.
    this.directCall = false;
    this.autoConnectId = '';
  }

  /**
   * Hanging up on a /call/<id> invite hands back to the expenses page and
   * clears the invite -- re-entering should be a fresh visit, not a second
   * automatic dial.
   */
  onCallEnded(): void {
    this.directCall = false;
    this.activeTab = 'expenses';
    this.autoConnectId = '';
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
