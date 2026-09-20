import type { Draft, ResolvedDraft } from './drafts';
import { dominantScript } from './language';
import { normalizeName } from './match';
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

/**
 * Fields that name a real thing in the user's books. If the user did not say
 * it, the assistant must not pick one: filing a purchase against the wrong
 * site is a silent, expensive error, and the model does reach for a plausible
 * name when left to itself. Account is absent on purpose (it legitimately
 * defaults to the last used one) and so is party, which may be brand new.
 */
const GROUNDED_FIELDS = ['project', 'plot', 'worker', 'investor'] as const;

/** Words worth matching on: ignore the short connectives in a name. */
const tokens = (text: string): string[] => normalizeName(text).split(' ').filter((w) => w.length >= 3);

/**
 * Drop any name the user never mentioned, in this message or the ones the
 * model can still see. The write then comes back as a question instead of a
 * guess. Returns the same draft when everything checks out.
 */
export function groundNames<T extends Draft>(draft: T, said: string): T {
  const heard = new Set(tokens(said));
  if (heard.size === 0) return draft;
  const saidScript = dominantScript(said);
  let stripped: Record<string, unknown> | null = null;
  for (const field of GROUNDED_FIELDS) {
    const value = (draft as Record<string, unknown>)[field];
    if (typeof value !== 'string' || !value) continue;
    // "بلال" and the saved "Bilal" are the same person in two scripts, and no
    // token comparison can see that. When the scripts differ the check cannot
    // speak, so it stays quiet rather than stripping a name the user did say.
    if (saidScript && dominantScript(value) && dominantScript(value) !== saidScript) continue;
    // Keep it when any meaningful word of the name was actually spoken.
    if (tokens(value).some((w) => heard.has(w))) continue;
    stripped ??= { ...draft };
    delete stripped[field];
  }
  return (stripped ?? draft) as T;
}

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
const NEEDS_PROJECT: ReadonlySet<Draft['kind']> = new Set<Draft['kind']>(['material', 'attendance', 'createPurchaseOrder', 'saleReceipt', 'saleCost', 'setSale']);

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

  // Labour: a day's hazri needs someone to mark it against.
  if (d.kind === 'attendance' && world.workers.length === 0) {
    gaps.push({ what: 'a worker to mark the day for, and there are none yet', mustCreate: true });
  }

  // Investors: the payment is from a named partner, so that partner must exist.
  if (d.kind === 'investorPayment' && !resolved.investor) {
    gaps.push(
      world.investors.length === 0
        ? { what: 'an investor this money came from, and there are none yet', mustCreate: true }
        : { what: `which investor "${d.investor ?? ''}" is`, mustCreate: false, choices: names(world.investors) }
    );
  }

  // Orders: money cannot be paid against an order the user does not have.
  if (d.kind === 'payPurchaseOrder' && (world.unpaidOrders ?? []).length === 0) {
    gaps.push({ what: 'an open purchase order to pay against, and there are none with money outstanding', mustCreate: true });
  }

  // Transfers move money between the user's OWN accounts: both ends must exist.
  if (d.kind === 'transfer') {
    if (world.accounts.length < 2) {
      gaps.push({ what: 'a second account to move the money into, and there is only one', mustCreate: true });
    } else {
      if (!resolved.account) gaps.push({ what: `which account "${d.from}" is`, mustCreate: false, choices: names(world.accounts) });
      if (!resolved.accountTo) gaps.push({ what: `which account "${d.to}" is`, mustCreate: false, choices: names(world.accounts) });
    }
  }

  if (world.accounts.length === 0 && (NEEDS_AMOUNT.has(d.kind) || d.kind === 'material')) {
    gaps.push({ what: 'an account for the money to move through, and there are none yet', mustCreate: true });
  }

  return gaps;
}

/** The instruction handed back to the model when a write is not ready. */
export function gapPrompt(gaps: readonly Gap[]): string {
  // Only the first gap is asked about: one question per turn beats a checklist,
  // and the rest come back on the next pass once this one is answered.
  const first = gaps[0];
  const choices = first.choices ?? [];
  return [
    `Not saved yet: this still needs ${first.what}.`,
    'Do NOT call this tool again yet, do not tell the user to open a screen, and do not tell them what is missing from the app.',
    'Reply with ONE line repeating what you already understood (with the figure), then ONE short question for this.',
    first.mustCreate
      ? 'They have none of these, so do not point that out: simply offer to make it ("Kya main bana doon?") and, once they agree, call the matching add_ tool and then redo this write.'
      : 'Ask for it in one short question.',
    choices.length > 0
      ? `The ONLY options are these, copied exactly onto an OPTIONS line: ${choices.join(' | ')}`
      : 'There is nothing to choose from, so write no OPTIONS line at all.',
  ]
    .filter(Boolean)
    .join(' ');
}
