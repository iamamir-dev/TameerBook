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
  reorderHint: string;
  restartForRtl: string;

  // Quick entry tiles (kept in Roman Urdu  no accounting jargon)
  kharcha: string; // expense / money out
  aamdani: string; // income / money in
  material: string;
  dehari: string; // daily wage labour
  investor: string;

  // Home
  greeting: string;
  moneyIn: string;
  moneyOut: string;
  today: string;
  netFlow: string;
  myProjects: string;
  seeAll: string;

  // Amount input
  amount: string;
  lakhSuffix: string;
  croreSuffix: string;

  // Common actions
  save: string;
  cancel: string;
  call: string;
  delete: string;
  add: string;
  search: string;
  selectOne: string;
  done: string;
  next: string;

  // Settings
  language: string;
  english: string;
  urdu: string;
  darkMode: string;
  appVersion: string;

  // Empty states
  comingSoon: string;
  comingSoonDetail: string;
  noProjectsYet: string;
  noProjectsDetail: string;
  noInvestorsYet: string;
  noInvestorsDetail: string;
  addFirstEntry: string;

  // Stage names (construction)

  // Projects module
  newProject: string;
  projectName: string;
  projectStartDate: string;
  totalSpent: string;
  back: string;
  create: string;
  review: string;

  // Wizard  step 1 (plot)
  society: string;
  block: string;
  plotNo: string;
  size: string;
  sizeUnit: string;
  unitMarla: string;
  unitKanal: string;
  unitSqyd: string;
  // Wizard  step 2 (price & seller)
  agreedPrice: string;
  sellerName: string;
  sellerPhone: string;
  // Wizard guidance / hints
  guideInvestors: string;
  guideReview: string;
  newInvestor: string;
  hintSociety: string;
  hintPhone: string;

  // Project detail
  tabInvestors: string;
  tabDocs: string;
  confirm: string;

  // Quick Entry
  selectProject: string;
  category: string;
  note: string;
  party: string;
  addNew: string;
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
  noUdhaar: string;
  noUdhaarDetail: string;

  // Home money
  cashLabel: string;

  // Khareedari / acquisition
  remaining: string;
  transferDeadline: string;
  editPlot: string;
  seller: string;
  categoryInUse: string;
  manageCategories: string;
  addCategoryLabel: string;
  addSubcategory: string;
  defaultUnit: string;
  name: string;
  deleteConfirm: string;
  paymentIn: string;
  paymentFromTitle: string;
  fromInvestor: string;
  fromProjectSale: string;
  fromPlotSale: string;
  fromUdhaarReturn: string;
  otherIncomeLabel: string;
  bookingTile: string;
  alsoPaidNow: string;
  goToSection: string;
  netSoFar: string;
  distributionRule: string;
  ruleOwnership: string;
  ruleOwnershipHint: string;
  ruleAgreedPct: string;
  ruleOwnerFirst: string;
  rulePrefReturn: string;
  ruleManual: string;
  stepPreview: string;
  ownerWorkSharePct: string;
  sumMustBe100: string;
  lossLockedNote: string;
  ownershipSection: string;
  distributionSection: string;
  settledOn: string;
  sadaqahPct: string;
  charityToggleHint: string;
  investorsPoolPct: string;
  ruleAgreedPctDesc: string;
  ruleOwnerFirstDesc: string;
  rulePrefReturnDesc: string;
  ruleManualDesc: string;
  infoWhatTitle: string;
  infoCalcTitle: string;
  ruleOwnershipCalc: string;
  ruleAgreedPctCalc: string;
  ruleOwnerFirstCalc: string;
  rulePrefReturnCalc: string;
  ruleManualCalc: string;
  detailsSection: string;
  projectLabel: string;
  markAttendance: string;
  ruleOwnershipDesc: string;
  selectSavedSupplier: string;
  selectSavedParty: string;
  netWorthLabel: string;
  addConstructionExpense: string;
  yesterday: string;
  statusesTitle: string;
  addStatus: string;
  setStatusLabel: string;
  noStatus: string;
  stageInUse: string;
  preferencesSection: string;
  setTransferDeadline: string;
  clearDeadline: string;
  bankDetails: string;
  optional: string;
  notMarkedToday: string;
  owedToSuppliers: string;
  openBookings: string;
  daysLeftSuffix: string;
  deadlineSoon: string;
  ptToken: string;
  ptBayana: string;
  ptInstallment: string;
  ptFinal: string;
  addPayment: string;
  feeOther: string;

  // Docs
  addDocument: string;
  docOther: string;

  // Tameer / material / dehari / contractor
  qtyLabel: string;
  unitLabel: string;
  rateLabel: string;
  totalLabel: string;
  billPhoto: string;
  supplier: string;
  constructionCost: string;
  topCategories: string;
  photoDiary: string;
  todayPhotos: string;
  noPhotos: string;

  // Investors (Musharakah)
  addInvestor: string;
  personName: string;
  phone: string;
  cnic: string;
  photo: string;
  totalCapital: string;
  attachInvestor: string;
  paidInCapital: string;
  ownershipPct: string;
  addInvestment: string;
  statement: string;
  capitalTimeline: string;
  perProjectBreakdown: string;
  profitEarned: string;
  availableBalance: string;
  addMoney: string;
  newInvestment: string;
  investFromBalance: string;
  payout: string;
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
  reportTitle: string;
  settledStatus: string;
  signaturesTitle: string;
  madeWith: string;
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
  projectSummary: string;
  statusDone: string;
  statusCurrent: string;

  // Project pipeline stage names (11)
  // Stage descriptions (shown in the per-stage drawer)

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
  phaseSaleCost: string;
  phaseGeneral: string;
  projectTotalCost: string;

  // Investment allocation
  allocationTitle: string;
  byProject: string;
  byInvestor: string;
  totalInvested: string;

  // v2  Labor
  laborTitle: string;
  addWorker: string;
  markAllPresent: string;
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
  errorTitle: string;
  errorBody: string;
  retry: string;

  // Labor section (worker khata)
  allWorkers: string;
  workerKhata: string;
  acrossProjects: string;
  historyTitle: string;
  attendanceConflict: string;
  owedToWorker: string;

  // Project lifecycle & validations
  markCompleted: string;
  markCompletedTitle: string;
  markCompletedBody: string;
  warnLaborDues: string;
  warnBuyerOwes: string;
  settleHint: string;
  confirmSettleTitle: string;
  confirmSettleBody: string;
  projectClosedNote: string;
  sectionActive: string;
  sectionCompleted: string;
  addPlot: string;
  noPlotChoice: string;
  ownerFunded: string;
  plotTaken: string;
  payTypeOnce: string;
  setWageFirst: string;
  workerInactive: string;
  investorAlreadyExited: string;
  profitPctRange: string;
  categoryRequired: string;
  investedLabel: string;
  noEligibleInvestors: string;
  emptyLedger: string;
  editProject: string;
  doneEditing: string;
  galleryTitle: string;

  // Settings — font & home layout
  fontFamilyLabel: string;
  fontSizeLabel: string;
  fsSmall: string;
  fsNormal: string;
  fsLarge: string;
  fsXL: string;
  homeSettingsTitle: string;

  // Review fixes + new features (bookings / plot sale / home expense)
  overdueLabel: string;
  ctTransferIn: string;
  ctTransferOut: string;
  ctWithdrawal: string;
  ctExitSettlement: string;
  ctProfitPayout: string;
  ctDonation: string;
  ctLossAdj: string;
  bookingsTitle: string;
  newBooking: string;
  receivedQty: string;
  remainingQty: string;
  addDelivery: string;
  payBookingLabel: string;
  payRemainingLabel: string;
  noBookings: string;
  itemName: string;
  sellPlot: string;
  salePriceLabel: string;
  plotProfit: string;
  gharKharcha: string;
  fixMistakeConfirmTitle: string;
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
  expand: string;
  collapse: string;
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
  obLaborTitle: string;
  obLaborBody: string;
  obInvestorsTitle: string;
  obInvestorsBody: string;
  obReportsTitle: string;
  obReportsBody: string;
}
