import {
  Activity,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  BrickWall,
  Building,
  Building2,
  Phone,
  Pencil,
  Type,
  ALargeSmall,
  Calendar,
  Camera,
  ChartColumn,
  History,
  Info,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Download,
  Eye,
  FileCheck,
  FileSignature,
  FileText,
  HandCoins,
  HardHat,
  House,
  Inbox,
  IndianRupee,
  KeyRound,
  Landmark,
  LandPlot,
  Languages,
  Lock,
  type LucideIcon,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  Receipt,
  ReceiptText,
  Repeat,
  ScrollText,
  Search,
  Settings,
  Share2,
  Stamp,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react-native';

/**
 * Semantic icon registry  every icon is a lucide component referenced by
 * MEANING (e.g. `ICONS.moneyIn`) rather than by name. To swap the icon set,
 * change this one file; nothing else touches concrete icon components.
 */
export const ICONS = {
  // Money & ledger
  moneyIn: ArrowDownLeft,
  moneyOut: ArrowUpRight,
  balance: Wallet,
  bank: Landmark,
  rupee: IndianRupee,
  history: History, // past entries / transactions
  info: Info,
  receipt: Receipt,
  ledger: ReceiptText,
  plot: LandPlot,

  // Documents (each property/legal paper has its own meaningful icon)
  document: FileText,
  pdf: FileText,
  statement: ScrollText,
  record: ScrollText, // Fard (record of rights)
  agreement: FileSignature, // بیع نامہ
  certificate: FileCheck, // NDC / clearance
  deed: Stamp, // registry / registered sale deed
  map: MapIcon, // naqsha / building plan
  transfer: Repeat, // ownership transfer
  key: KeyRound, // possession / handover
  preview: Eye,
  download: Download,
  share: Share2,
  tag: Tag, // listed for sale

  // Quick-entry concepts
  kharcha: TrendingDown,
  aamdani: TrendingUp,
  material: Package,
  dehari: HardHat,
  investor: HandCoins,

  // Construction
  project: Building2,
  foundation: Building,
  brick: BrickWall,
  truck: Truck,
  tools: Wrench,

  // Navigation / tabs
  home: House,
  projects: Building2,
  reports: ChartColumn,
  investors: Users,
  add: Plus,
  more: MoreHorizontal,
  print: Printer,
  settings: Settings,

  // UI affordances
  bell: Bell,
  phone: Phone,
  edit: Pencil,
  font: Type,
  textSize: ALargeSmall,
  back: ChevronLeft,
  forward: ChevronRight,
  expand: Maximize2,
  collapse: Minimize2,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  netFlow: ArrowLeftRight,
  today: Calendar,
  activity: Activity,
  search: Search,
  close: X,
  trash: Trash2,
  check: Check,
  checkCircle: CircleCheck,
  alert: TriangleAlert,
  dotCurrent: CircleDot,
  dotNext: Circle,
  language: Languages,
  moon: Moon,
  empty: Inbox,
  camera: Camera,
  lock: Lock,
  reorder: ArrowDownUp,
} satisfies Record<string, LucideIcon>;

/** Type-safe semantic icon keys. */
export type IconKey = keyof typeof ICONS;

/**
 * Back-compat alias. Icons are now lucide components addressed by semantic
 * key, so a "raw glyph name" is just an `IconKey`. Kept so existing
 * `IconKey | GlyphName` prop signatures keep compiling.
 */
export type GlyphName = IconKey;

/** The lucide component type, re-exported for wrappers. */
export type { LucideIcon };

/** Resolve a semantic key to its lucide component. */
export const iconFor = (key: IconKey): LucideIcon => ICONS[key];
