export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'TEAM_MEMBER';

// CRM Types
export type OrderStatus = 'NEW' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'NO_ANSWER' | 'CANCELLED' | 'REFUSED' | 'SHIPPED' | 'DELIVERED' | 'RETURNED';
export type OrderPaymentStatus = 'PAID' | 'COD_PENDING' | 'REFUNDED';
export type OrderSource = 'FACEBOOK_ADS' | 'TIKTOK_ADS' | 'GOOGLE_ADS' | 'ORGANIC' | 'WHATSAPP' | 'INSTAGRAM' | 'OTHER';
export type CommissionType = 'FIXED_PER_ORDER' | 'PERCENTAGE';

export interface CrmOrder {
  id: string;
  clientId: string;
  client?: { id: string; name: string };
  closerId?: string;
  closer?: { id: string; name: string; avatar?: string };
  customerId?: string;
  customer?: { id: string; name: string };
  shopifyOrderId?: string;
  shopifyStore?: string;
  customerName: string;
  customerPhone?: string;
  customerCity?: string;
  productName: string;
  quantity: number;
  orderAmount: number;
  productCost: number;
  shippingCost: number;
  adCost: number;
  closerCommission: number;
  netProfit: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  source: OrderSource;
  notes?: string;
  closerNotes?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCustomer {
  id: string;
  clientId: string;
  name: string;
  phone?: string;
  city?: string;
  address?: string;
  notes?: string;
  totalSpend: number;
  orderCount: number;
  createdAt: string;
  _count?: { orders: number };
}

export interface ShopifyConfig {
  id: string;
  clientId: string;
  client?: { id: string; name: string };
  storeName: string;
  storeUrl: string;
  accessToken: string;
  active: boolean;
  lastSyncAt?: string;
  createdAt: string;
}

export interface CommissionRule {
  id: string;
  clientId: string;
  client?: { id: string; name: string };
  closerId?: string;
  closer?: { id: string; name: string };
  name: string;
  type: CommissionType;
  fixedAmount?: number;
  percentage?: number;
  active: boolean;
  description?: string;
  createdAt: string;
}

export interface CloserCommissionRecord {
  id: string;
  closerId: string;
  closer?: { id: string; name: string };
  orderId: string;
  order?: { id: string; customerName: string; productName: string; orderAmount: number; confirmedAt?: string };
  amount: number;
  paid: boolean;
  paidAt?: string;
  createdAt: string;
}

export interface CloserStat {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isCloser: boolean;
  totalOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  conversionRate: number;
  totalEarnings: number;
}
export type Currency = 'MAD' | 'USD' | 'EUR';
export interface ExchangeRates { [base: string]: { [target: string]: number } }

export type ClientStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'PENDING' | 'ONE_TIME';
export type BillingFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CASH' | 'CHECK' | 'PAYPAL' | 'OTHER';
export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE';
export type ExpenseCategory = 'RENT' | 'SALARIES' | 'SOFTWARE_SUBSCRIPTIONS' | 'INSURANCE' | 'ADS_SPEND' | 'FREELANCERS' | 'EQUIPMENT' | 'TRAVEL' | 'MISC';
export type ExpenseType = 'FIXED' | 'VARIABLE';
export type ExpensePaymentStatus = 'PAID' | 'PENDING';
export type LeadSource = 'REFERRAL' | 'WEBSITE' | 'SOCIAL_MEDIA' | 'COLD_OUTREACH' | 'EVENT';
export type LeadStage = 'NEW' | 'WARMED' | 'CLOSED_WON' | 'CLOSED_LOST';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  phone?: string;
  active: boolean;
  suspended: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

export interface CompanyService {
  id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  service: string;
  monthlyFee: number;
  billingFrequency: BillingFrequency;
  status: ClientStatus;
  startDate: string;
  website?: string;
  googleDriveLink?: string;
  notes?: string;
  contactPerson: string;
  email: string;
  phone?: string;
  country?: string;
  preferredCurrency: Currency;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { payments: number; tasks: number };
}

export interface Payment {
  id: string;
  clientId: string;
  client?: Pick<Client, 'id' | 'name' | 'service'>;
  amount: number;
  date: string;
  method: PaymentMethod;
  invoiceNumber?: string;
  status: PaymentStatus;
  notes?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  type: ExpenseType;
  amount: number;
  date: string;
  method?: PaymentMethod;
  notes?: string;
  recurring: boolean;
  paymentStatus: ExpensePaymentStatus;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  service: string;
  expectedValue?: number;
  source: LeadSource;
  stage: LeadStage;
  assignedToId?: string;
  assignedTo?: Pick<User, 'id' | 'name' | 'avatar'>;
  notes?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number };
  activities?: LeadActivity[];
}

export interface LeadActivity {
  id: string;
  leadId: string;
  note: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedToId?: string;
  assignedTo?: Pick<User, 'id' | 'name' | 'avatar'>;
  clientId?: string;
  client?: Pick<Client, 'id' | 'name'>;
  priority: Priority;
  dueDate?: string;
  status: TaskStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  user?: Pick<User, 'id' | 'name' | 'avatar'>;
  clientId?: string;
  client?: Pick<Client, 'id' | 'name'>;
  module: string;
  action: string;
  details?: string;
  createdAt: string;
}

export interface DashboardStats {
  activeClients: number;
  pendingTasks: number;
  openLeads: number;
  overduePayments: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  revenueGrowth: number;
  conversionRate: number;
  recentActivity: ActivityLog[];
  mrr: number;
  retentionRate: number;
  roas: number | null;
  cashflowForecast: number;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: number;
  teamProductivity: number;
  profitMargin: number;
  currency: Currency;
}

export interface MonthlyChartData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export type MeetingStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface MeetingType {
  id: string;
  name: string;
  duration: number;
  description?: string;
  color: string;
  active: boolean;
  createdAt: string;
}

export interface AdminAvailability {
  id: string;
  adminId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface BlockedDate {
  id: string;
  adminId: string;
  blockedDate: string;
  reason?: string;
}

export interface Meeting {
  id: string;
  clientId?: string;
  client?: Pick<Client, 'id' | 'name'>;
  adminId: string;
  admin?: Pick<User, 'id' | 'name' | 'avatar'>;
  meetingTypeId?: string;
  meetingType?: MeetingType;
  title: string;
  description?: string;
  meetingLink?: string;
  status: MeetingStatus;
  startTime: string;
  endTime: string;
  timezone: string;
  notes?: string;
  internalNotes?: string;
  cancelReason?: string;
  bookedByPortalUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChannelType = 'PUBLIC' | 'PRIVATE';
export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM';

export interface ChannelMemberEntry {
  user: { id: string; name: string; avatar?: string; role: string };
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: ChannelType;
  createdAt: string;
  _count?: { messages: number };
  members?: ChannelMemberEntry[];
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  role: Role;
  onlineStatus: boolean;
  lastSeen?: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user: { id: string; name: string };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  sender: { id: string; name: string; avatar?: string; role: Role };
  channelId?: string;
  conversationId?: string;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  replyToId?: string;
  replyTo?: { id: string; content: string; sender: { id: string; name: string } } | null;
  reactions: MessageReaction[];
  edited: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Client Portal Types ──────────────────────────────────────────────────────

export type ContentCategory = 'SOCIAL_POST' | 'REEL' | 'VIDEO' | 'AD_CREATIVE' | 'BANNER' | 'THUMBNAIL' | 'BRANDING' | 'OTHER';
export type ContentStatus = 'DRAFT' | 'WAITING_APPROVAL' | 'APPROVED' | 'NEEDS_REVISION' | 'PUBLISHED';
export type ProjectPhase = 'DISCOVERY' | 'PLANNING' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'DEPLOYMENT' | 'MAINTENANCE';

export interface PortalClient {
  id: string;
  name: string;
  service: string;
  monthlyFee: number;
  status: ClientStatus;
  startDate: string;
  contactPerson: string;
  email: string;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
  clientId: string;
  client: PortalClient;
}

export interface ProjectUpdate {
  id: string;
  clientId: string;
  title: string;
  content: string;
  phase?: ProjectPhase;
  imageUrl?: string;
  fileUrl?: string;
  postedById: string;
  postedBy: { name: string; avatar?: string };
  createdAt: string;
  updatedAt: string;
  comments: UpdateComment[];
  _count?: { comments: number };
}

export interface UpdateComment {
  id: string;
  updateId: string;
  content: string;
  isClient: boolean;
  authorName: string;
  authorId?: string;
  createdAt: string;
}

export interface ContentDelivery {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  fileUrl?: string;
  previewUrl?: string;
  externalLink?: string;
  category: ContentCategory;
  status: ContentStatus;
  uploadedById: string;
  uploadedBy: { name: string };
  clientComment?: string;
  revisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNotification {
  id: string;
  clientPortalUserId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface KpiSummary {
  spend: number;
  reach: number;
  impressions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  leads: number;
  purchases: number;
  roas: number;
  costPerLead: number;
  conversionRate: number;
}

export interface KpiDailyEntry {
  date: string;
  spend: number;
  reach: number;
  leads: number;
  roas: number;
}

export interface KpiData {
  isMock: boolean;
  datePreset: string;
  summary: KpiSummary;
  daily: KpiDailyEntry[];
}

export interface PortalDashboard {
  client: Client;
  recentPayments: Payment[];
  paidTotal: number;
  pendingInvoices: number;
  pendingAmount: number;
  recentUpdates: ProjectUpdate[];
  unreadNotifications: number;
  pendingApprovals: number;
}

export interface PortalAdminClient extends Client {
  portalUser?: {
    id: string;
    email: string;
    name: string;
    active: boolean;
    lastLogin?: string;
  } | null;
}
