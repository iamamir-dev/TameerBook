import type { Draft, ResolvedDraft } from './drafts';
import type { World } from './prompts';

/**
 * IS THIS WRITE READY TO SHOW?
 *
 * The confirmation card is a receipt, not a form: the user should read it and
 * tap Accept. A card that arrives with a blank amount, an empty picker or a
 * warning is the assistant pushing its own homework onto the user.
 *
 * So before a write becomes a card, the agent asks here what is still unknown.
 * Anything listed comes back to the model as a question to ask in the chat
 * ("kis project ke liye?", "abhi koi project nahi hai, main bana doon?"), and
 * only a complete write is ever shown. Pure + unit-tested.
 */

export interface Gap {
  /** What is missing, in the model's vocabulary. */
  what: string;
  /** True when the user owns none of these yet, so the answer is to create one. */
  mustCreate: boolean;
  /** Names the user could pick from, when there are few enough to offer. */
  choices?: string[];
}

/** Money tools: the amount is the whole point of the entry. */
const NEEDS_AMOUNT: ReadonlySet<Draft['kind']> = new Set<Draft['kind']>([
  'expense',
  'income',
  'payWorker',
  'udhaarGive',
  'udhaarReturn',
  'transfer',
  'payPurchaseOrder',
  'plotPayment',
  'plotExpense',
  'saleReceipt',
  'saleCost',
  'investorPayment',
]);

/** Writes that cannot be filed anywhere but a project. */
const NEEDS_PROJECT: ReadonlySet<Draft['kind']> = new Set<Draft['kind']>(['material', 'attendance', 'createPurchaseOrder', 'saleReceipt', 'saleCost']);

/** add_* tools: without a name there is nothing to create. */
const NEEDS_NAME: ReadonlySet<Draft['kind']> = new Set<Draft['kind']>(['createWorker', 'createParty', 'createInvestor', 'createAccount', 'createPlot', 'createProject']);

const MAX_CHOICES = 8;
const names = (list: readonly { name: string }[]): string[] | undefined => (list.length > 0 && list.length <= MAX_CHOICES ? list.map((x) => x.name) : undefined);

/**
 * What the chat must settle before this write can be shown as a card.
 * Empty array = ready. The ACCOUNT is deliberately absent: the card defaults
 * to the last-used account, so asking every time would be noise.
 */
export function draftGaps(resolved: ResolvedDraft, world: World): Gap[] {
  const d = resolved.draft;
  const gaps: Gap[] = [];

  if (NEEDS_AMOUNT.has(d.kind) && !('amount' in d && typeof d.amount === 'number' && d.amount > 0)) {
    gaps.push({ what: 'the amount in rupees', mustCreate: false });
  }
  if (d.kind === 'material' && d.amount === undefined && (d.qty === undefined || d.rate === undefined)) {
    gaps.push({ what: 'the quantity and the rate (or the total)', mustCreate: false });
  }
  if (d.kind === 'setSale' && !d.price) gaps.push({ what: 'the agreed sale price', mustCreate: false });

  if (NEEDS_NAME.has(d.kind) && !('name' in d && d.name)) {
    gaps.push({ what: `a name for the new ${d.kind.replace('create', '').toLowerCase()}`, mustCreate: false });
  }

  // With exactly one project there is nothing to ask: it is the only answer,
  // and the card fills it in. Ask only when the user would have to choose.
  if (NEEDS_PROJECT.has(d.kind) && !resolved.project && world.projects.length !== 1) {
    gaps.push(
      world.projects.length === 0
        ? { what: 'a project to file this under, and there are none yet', mustCreate: true }
        : { what: 'which project this belongs to', mustCreate: false, choices: names(world.projects) }
    );
  }

  // A plot the user has none of cannot be chosen, only created.
  if (d.kind === 'createProject' && !resolved.plot) {
    const free = world.plots.filter((p) => !p.taken);
    gaps.push(
      free.length === 0
        ? { what: 'a free plot for the project, and there are none yet', mustCreate: true }
        : { what: 'which free plot the project sits on', mustCreate: false, choices: names(free) }
    );
  }

  if (d.kind === 'payWorker' && !resolved.worker) {
    gaps.push(
      world.workers.length === 0
        ? { what: 'a saved worker to pay, and there are none yet', mustCreate: true }
        : { what: `which worker "${d.worker}" is`, mustCreate: false, choices: names(world.workers) }
    );
  }

  if ((d.kind === 'plotPayment' || d.kind === 'plotExpense' || d.kind === 'markTransferred') && !resolved.plot && world.plots.length !== 1) {
    gaps.push(
      world.plots.length === 0
        ? { what: 'a plot, and there are none yet', mustCreate: true }
        : { what: 'which plot this is for', mustCreate: false, choices: names(world.plots) }
    );
  }

  if (world.accounts.length === 0 && (NEEDS_AMOUNT.has(d.kind) || d.kind === 'material')) {
    gaps.push({ what: 'an account for the money to move through, and there are none yet', mustCreate: true });
  }

  return gaps;
}

/** The instruction handed back to the model when a write is not ready. */
export function gapPrompt(gaps: readonly Gap[]): string {
  const missing = gaps.map((g) => g.what).join('; ');
  const create = gaps.filter((g) => g.mustCreate);
  const choices = gaps.flatMap((g) => g.choices ?? []);
  return [
    `Not saved: this needs ${missing}.`,
    'Do NOT call this tool again yet and do not tell the user to open a screen.',
    create.length > 0
      ? 'The user owns none of these, so OFFER TO CREATE IT YOURSELF in one short sentence and wait for a yes; when they agree, call the matching add_ tool.'
      : 'Ask the user for it in ONE short sentence.',
    choices.length > 0 && choices.length <= MAX_CHOICES ? `Offer these on an OPTIONS line, copied exactly: ${choices.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
