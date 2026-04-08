/**
 * @webwaka/pos — POS terminal management + float double-entry ledger.
 * (Platform Invariants P9, T3, T4)
 *
 * M7b: Offline Sync + USSD Gateway + POS Float Ledger
 */

export {
  postLedgerEntry,
  reverseLedgerEntry,
  getLedgerHistory,
  InsufficientFloatError,
} from './float-ledger.js';
export type { LedgerEntry, LedgerResult, LedgerRow } from './float-ledger.js';

export {
  registerTerminal,
  getTerminalByRef,
  updateTerminalLastSeen,
  suspendTerminal,
} from './terminal.js';
export type { PosTerminal } from './terminal.js';

export {
  createAgentWallet,
  getWalletBalance,
  getFloatHistory,
} from './wallet.js';
export type { WalletBalance } from './wallet.js';
