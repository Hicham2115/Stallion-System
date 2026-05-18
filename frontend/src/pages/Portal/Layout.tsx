import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart2,
  Image,
  GitBranch,
  FileText,
  Bell,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  CalendarClock,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import stallionLogo from "@/assets/png.png";
import { cn } from "@/lib/utils";
import { usePortalAuth, portalApi } from "@/context/PortalAuthContext";
import {
  PortalCurrencyProvider,
  usePortalCurrency,
} from "@/context/PortalCurrencyContext";
import { ClientNotification, Currency } from "@/types";

const CURRENCIES: Currency[] = ["MAD", "USD", "EUR"];

const navItems = [
  { to: "/portal", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/portal/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/portal/costs", icon: Receipt, label: "Costs" },
  { to: "/portal/orders", icon: ShoppingCart, label: "My Orders" },
  { to: "/portal/content", icon: Image, label: "Creative Delivery" },
  { to: "/portal/updates", icon: GitBranch, label: "Project Updates" },
  { to: "/portal/invoices", icon: FileText, label: "Invoices" },
  { to: "/portal/meetings", icon: CalendarClock, label: "Book a Meeting" },
];

function PortalLayoutContent() {
  const { user, logout } = usePortalAuth();
  const { currency, setCurrency } = usePortalCurrency();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    portalApi
      .get<ClientNotification[]>("/notifications")
      .then(({ data }) => {
        setNotifications(data.slice(0, 8));
        setUnread(data.filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/portal/login");
  };

  const markAllRead = async () => {
    await portalApi.put("/notifications/read-all");
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="min-h-screen flex bg-[#060b18] text-white">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#080d1c] border-r border-slate-800/60 transform transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <img
              src={stallionLogo}
              alt="Stallion Advertising"
              className="h-9 w-auto object-contain"
            />
            <div className="text-[10px] text-amber-400 font-medium tracking-widest uppercase">
              Client Portal
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client info */}
        <div className="px-4 py-4 border-b border-slate-800/60">
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/15 rounded-xl p-3">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-0.5">
              Client
            </div>
            <div className="text-sm font-bold text-white truncate">
              {user?.client?.name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {user?.client?.service}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
                )
              }
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800/60">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 flex items-center justify-between px-5 border-b border-slate-800/60 bg-[#080d1c]/80 backdrop-blur-sm sticky top-0 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:block text-sm text-slate-500">
            Hello,{" "}
            <span className="text-white font-semibold">{user?.name}</span> 👋
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Currency toggle */}
            <div className="hidden sm:flex items-center gap-0.5 bg-slate-800/60 border border-slate-700/40 rounded-lg p-0.5">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    currency === c
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white transition-all"
              >
                <Bell className="w-4.5 h-4.5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-[#0d1528] border border-slate-700/50 rounded-xl shadow-2xl z-[60] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                    <span className="text-sm font-semibold text-white">
                      Notifications
                    </span>
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-amber-400 hover:text-amber-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            "px-4 py-3 border-b border-slate-800/50 last:border-0",
                            !n.read && "bg-amber-500/5",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                            )}
                            <div
                              className={cn(
                                !n.read && "ml-0",
                                n.read && "ml-3.5",
                              )}
                            >
                              <div className="text-sm font-medium text-white">
                                {n.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {n.message}
                              </div>
                              <div className="text-[10px] text-slate-600 mt-1">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/50 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-300 hidden sm:block max-w-24 truncate">
                  {user?.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 w-48 bg-[#0d1528] border border-slate-700/50 rounded-xl shadow-2xl z-[60] overflow-hidden">
                  <NavLink
                    to="/portal/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </NavLink>
                  <div className="border-t border-slate-700/50" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-all w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Click outside to close dropdowns */}
      {(notifOpen || profileOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setNotifOpen(false);
            setProfileOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function PortalLayout() {
  const { user } = usePortalAuth();
  const defaultCurrency = (user?.client as any)?.preferredCurrency;

  return (
    <PortalCurrencyProvider defaultCurrency={defaultCurrency}>
      <PortalLayoutContent />
    </PortalCurrencyProvider>
  );
}
