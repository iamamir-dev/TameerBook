/**
 * Supported languages:
 * - `ur` Urdu (اردو  full Urdu script, the default audience)
 * - `en` English
 */
export type Language = 'en' | 'ur';

/**
 * The shape of a translation dictionary. `en.ts` is the canonical key set;
 * `ur.ts` is type-checked against it so a missing key is a compile error.
 */
export interface TranslationKeys {
  // App / nav
  appName: string;
  home: string;
  projects: string;
  investors: string;
  reports: string;
  settings: string;
  quickEntry: string;
  notifications: string;

  // Quick entry tiles (kept in Roman Urdu  no accounting jargon)
  kharcha: string; // expense / money out
  aamdani: string; // income / money in
  material: string;
  dehari: string; // daily wage labour
  investor: string;

  // Home
  greeting: string;
  acrossAllProjects: string;
  moneyIn: string;
  moneyOut: string;
  today: string;
  netFlow: string;
  myProjects: string;
  todaysEntries: string;
  seeAll: string;

  // Amount input
  amount: string;
  quickAdd10k: string;
  quickAdd50k: string;
  quickAdd1lakh: string;
  quickAdd5lakh: string;
  lakhSuffix: string;
  croreSuffix: string;

  // Common actions
  save: string;
  cancel: string;
  delete: string;
  add: string;
  search: string;
  selectOne: string;
  done: string;
  current: string;
  next: string;

  // Settings
  language: string;
  english: string;
  urdu: string;
  darkMode: string;
  appVersion: string;
  profitSharing: string;
  investorProfitShare: string;
  profitShareNote: string;

  // Empty states
  comingSoon: string;
  comingSoonDetail: string;
  noProjectsYet: string;
  noProjectsDetail: string;
  noInvestorsYet: string;
  noInvestorsDetail: string;
  addFirstEntry: string;

  // Stage names (construction)
  stageFoundation: string;
  stageGreyStructure: string;
  stageFinishing: string;
  stageHandover: string;

  // Projects module
  newProject: string;
  projectName: string;
  totalSpent: string;
  back: string;
  create: string;
  review: string;

  // Wizard  step 1 (plot)
  plotInfo: string;
  society: string;
  block: string;
  plotNo: string;
  size: string;
  sizeUnit: string;
  unitMarla: string;
  unitKanal: string;
  unitSqyd: string;
  // Wizard  step 2 (price & seller)
  priceSeller: string;
  agreedPrice: string;
  sellerName: string;
  sellerPhone: string;
  dealerOptional: string;
  // Wizard guidance / hints
  guidePlot: string;
  guidePrice: string;
  guideInvestors: string;
  guideReview: string;
  newInvestor: string;
  orAddNew: string;
  hintSociety: string;
  hintPhone: string;

  // Project detail
  totalLagat: string;
  totalAamdani: string;
  cashThisMonth: string;
  tabKhareedari: string;
  tabTameer: string;
  tabSale: string;
  tabInvestors: string;
  tabDocs: string;
  moveNextStage: string;
  saveAndNext: string;
  toContinue: string;
  fillRequired: string;
  moveStageQuestion: string;
  stageHistory: string;
  confirm: string;
  stagesTitle: string;
  progressTitle: string;
  moneyTitle: string;

  // Quick Entry
  selectProject: string;
  category: string;
  note: string;
  party: string;
  addNew: string;
  paymentMode: string;
  modeCash: string;
  modeBank: string;
  modeJazzcash: string;
  modeCredit: string;
  date: string;
  photoReceipt: string;
  savedToast: string;
  enterAmount: string;

  // Transactions
  transactions: string;
  filterAll: string;
  filterIn: string;
  filterOut: string;
  thisMonth: string;
  fixMistake: string;
  fixMistakeExplain: string;

  // Udhaar
  udhaar: string;
  payable: string;
  payNow: string;
  noUdhaar: string;
  noUdhaarDetail: string;

  // Home money
  cashLabel: string;
  bankLabel: string;

  // Khareedari / acquisition
  totalPaid: string;
  remaining: string;
  transferDeadline: string;
  daysLeftSuffix: string;
  deadlineSoon: string;
  ptToken: string;
  ptBayana: string;
  ptInstallment: string;
  ptFinal: string;
  addPayment: string;
  agreementPhoto: string;
  transferTitle: string;
  transferDate: string;
  taxesFees: string;
  feeStampDuty: string;
  feeCvt: string;
  feeRegistration: string;
  fee236k: string;
  feeSocietyTransfer: string;
  feeOther: string;
  moveToPossessionQuestion: string;

  // Docs
  addDocument: string;
  docLabelTitle: string;
  docFard: string;
  docNdc: string;
  docRegistry: string;
  docAgreement: string;
  docTaxChallan: string;
  docNaqsha: string;
  docOther: string;
  noDocs: string;

  // Tameer / material / dehari / contractor
  qtyLabel: string;
  unitLabel: string;
  rateLabel: string;
  totalLabel: string;
  billPhoto: string;
  supplier: string;
  paidToggle: string;
  paidTo: string;
  constructionCost: string;
  topCategories: string;
  milestonesTitle: string;
  photoDiary: string;
  todayPhotos: string;
  contractorPayment: string;
  againstNote: string;
  markDone: string;
  supplierLedger: string;
  purchases: string;
  payments: string;
  noPhotos: string;

  // Investors (Musharakah)
  addInvestor: string;
  personName: string;
  phone: string;
  cnic: string;
  photo: string;
  totalCapital: string;
  attachInvestor: string;
  committedAmount: string;
  profitPct: string;
  remainingPct: string;
  paidInCapital: string;
  ownershipPct: string;
  lossRuleNote: string;
  addInvestment: string;
  statement: string;
  editProfitConfirm: string;
  capitalTimeline: string;
  perProjectBreakdown: string;
  ctInitial: string;
  ctAdditional: string;
  selectInvestor: string;

  // Exit wizard
  exitTitle: string;
  exitWho: string;
  exitScenario: string;
  scPartnerBuy: string;
  scNewInvestor: string;
  scOwnerBuy: string;
  scPartial: string;
  scCommitted: string;
  exitValue: string;
  exitValueNote: string;
  confirmAgreed: string;
  buyer: string;
  portionAmount: string;
  beforeLabel: string;
  afterLabel: string;
  exitReceipt: string;

  // Sale module
  outstanding: string;
  addReceipt: string;
  sellerCosts: string;
  feeDealerCommission: string;
  fee236c: string;
  feeSocietyCharges: string;
  saleNdc: string;

  // Settlement
  settleTitle: string;
  revenue: string;
  totalExpenses: string;
  netProfit: string;
  owner: string;
  netLoss: string;
  capitalBack: string;
  profitShare: string;
  lossShare: string;
  finalPayout: string;
  settlementReceipt: string;
  closedBanner: string;

  // Reports
  rptSummary: string;
  rptPnl: string;
  rptCashflow: string;
  rptExpense: string;
  rptInvestment: string;
  rptRoi: string;
  invested: string;
  daysRunning: string;
  runningBalance: string;
  netLabel: string;
  topSuppliers: string;
  roiPct: string;
  durationLabel: string;
  profitLabel: string;
  allProjects: string;
  paidLabel: string;

  // Reminders
  reminders: string;
  remDaily: string;
  remDeadline: string;
  remUdhaar: string;
  remBuyer: string;
  notifDailyTitle: string;
  notifDailyBody: string;
  notifDeadlineTitle: string;
  notifDeadlineBody: string;
  notifUdhaarTitle: string;
  notifUdhaarBody: string;
  notifBuyerTitle: string;
  notifBuyerBody: string;

  // Report preview / export
  preview: string;
  shareLabel: string;
  download: string;
  savedToDevice: string;

  // Stage validation
  needToken: string;
  needBayana: string;
  needTransferDate: string;
  needConstruction: string;
  needSettle: string;
  needFard: string;
  needAgreement: string;
  needNdc: string;
  needRegistry: string;
  buyingSteps: string;
  attachLabel: string;
  attachedLabel: string;
  autoAdvanceNote: string;
  invalidDateOrder: string;
  saleSteps: string;
  saleStepList: string;
  saleStepBayana: string;
  saleStepNdc: string;
  saleStepTransfer: string;
  projectSummary: string;
  investorDetails: string;
  tapStageHint: string;
  statusDone: string;
  statusCurrent: string;
  statusPending: string;
  viewTimeline: string;
  hideTimeline: string;
  youAreHere: string;
  toolsTitle: string;
  nextLabel: string;
  phaseDescBuy: string;
  phaseDescBuild: string;
  phaseDescSell: string;

  // Project pipeline stage names (11)
  pstageDealPipeline: string;
  pstageNegotiation: string;
  pstageAgreement: string;
  pstageTokenPaid: string;
  pstageBayanaPaid: string;
  pstageTransfer: string;
  pstagePossession: string;
  pstageConstruction: string;
  pstageFinishing: string;
  pstageListedForSale: string;
  pstageClosed: string;
  // Stage descriptions (shown in the per-stage drawer)
  sDealPipeline: string;
  sNegotiation: string;
  sAgreement: string;
  sTokenPaid: string;
  sBayanaPaid: string;
  sTransfer: string;
  sPossession: string;
  sConstruction: string;
  sFinishing: string;
  sListed: string;
  sClosed: string;

  // v2  Accounts / cash flow
  accountsTitle: string;
  accountLabel: string;
  accountBank: string;
  accountCash: string;
  accountWallet: string;
  openingBalance: string;
  totalBalance: string;
  addAccount: string;
  accountName: string;
  transferTitleV2: string;
  fromAccount: string;
  toAccount: string;
  selectAccount: string;
  recentActivity: string;
  cashFlowTitle: string;
  noAccountTxns: string;

  // v2  Plots
  plotsTitle: string;
  plotLabel: string;
  newPlot: string;
  plotName: string;
  dealPrice: string;
  paidToSeller: string;
  plotExpensesLabel: string;
  totalCostLabel: string;
  includeInProject: string;
  sellerPayment: string;
  addExpense: string;
  plotOwned: string;
  plotInProject: string;
  plotSold: string;
  noPlotsYet: string;
  noPlotsDetail: string;
  selectPlot: string;
  noFreePlots: string;

  // v2  Project phases
  phasePlot: string;
  phaseConstruction: string;
  phaseSale: string;
  projectTotalCost: string;
  viewPlotDetail: string;

  // v2  Labor
  laborTitle: string;
  addWorker: string;
  workerName: string;
  dailyWage: string;
  attendanceTitle: string;
  attFull: string;
  attHalf: string;
  attAbsent: string;
  wageBalance: string;
  earnedLabel: string;
  takenLabel: string;
  payWorker: string;
  noWorkers: string;
  daysLabel: string;

  // v2  Udhaar (person lending)
  giveUdhaar: string;
  returnUdhaar: string;
  receivable: string;
  udhaarGiven: string;
  udhaarTaken: string;
  newUdhaar: string;
  clearedLabel: string;
  givenLabel: string;
  returnedLabel: string;

  // v2  Donation / settlement
  donationLabel: string;
  donationPctLabel: string;
  donationNote: string;
  totalDonation: string;
  ownerInvested: string;
  payoutLabel: string;

  // v2  Sale detail
  saleDeal: string;
  buyerReceipts: string;
  saleCosts: string;
  buyerName: string;
  noProject: string;

  // v2  Validation / cash tab
  insufficientFunds: string;
  duplicateAccount: string;
  exceedsRemaining: string;
  tabCash: string;
  receivedNow: string;
  obWelcomeBody: string;
  optionalDetails: string;
  companyNameHint: string;
  openingCashHint: string;
  setupFinalStep: string;
  edit: string;
  editInvestor: string;
  deleteInvestorConfirm: string;
  investorInUse: string;
  investmentInProject: string;
  enterInvestorAmounts: string;
  noCommittedSet: string;
  expand: string;
  collapse: string;
  selectInvestorsNote: string;
  receivePayment: string;
  receivedLabel: string;
  ownershipAutoNote: string;

  // v2  Company / onboarding
  companyTitle: string;
  companyName: string;
  ownerName: string;
  createCompanyLabel: string;
  switchCompany: string;
  newCompany: string;
  companySetupTitle: string;
  companySetupBody: string;
  openingCash: string;
  totalAssets: string;
  assetPlots: string;
  assetConstruction: string;
  obSkip: string;
  obGetStarted: string;
  obCashTitle: string;
  obCashBody: string;
  obPlotsTitle: string;
  obPlotsBody: string;
  obProjectsTitle: string;
  obProjectsBody: string;
  obReportsTitle: string;
  obReportsBody: string;
}
