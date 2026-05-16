import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Receipt,
  Target,
  CheckSquare,
  X,
  TrendingUp,
  UserCog,
  Layers,
  MessageSquare,
  Globe,
  CalendarClock,
  ShoppingCart,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import logo from "../assets/png.png";

const managerNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/revenue", icon: DollarSign, label: "Revenue" },
  { to: "/expenses", icon: Receipt, label: "Expenses" },
  { to: "/leads", icon: Target, label: "Leads" },
];

const allNav = [
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/my-orders", icon: Package, label: "My Orders" },
  { to: "/meetings", icon: CalendarClock, label: "Meetings" },
  { to: "/chat", icon: MessageSquare, label: "Team Chat" },
];

const crmNav = [
  { to: "/crm", icon: ShoppingCart, label: "CRM & Orders" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavItem({ to, icon: Icon, label, exact, onClick }: { to: string; icon: React.ElementType; label: string; exact?: boolean; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800",
        )
      }
    >
      <Icon className="w-4.5 h-4.5 shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { isAdmin, isManager } = useAuth();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-slate-900 dark:bg-[#080d1a] border-r border-slate-700/50 transform transition-transform duration-200 ease-in-out",
        "lg:relative lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Stallion Logo" width={180} height={180} />
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isManager && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Main
            </div>
            {managerNav.map(({ to, icon, label, exact }) => (
              <NavItem key={to} to={to} icon={icon} label={label} exact={exact} onClick={onClose} />
            ))}
            <div className="pt-2" />
          </>
        )}

        {allNav.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClick={onClose} />
        ))}

        {isManager && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-5 mb-2">
              CRM & Orders
            </div>
            {crmNav.map(({ to, icon, label }) => (
              <NavItem key={to} to={to} icon={icon} label={label} onClick={onClose} />
            ))}
            <div className="pt-2" />
          </>
        )}

        {isAdmin && (
          <>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mt-5 mb-2">
              Administration
            </div>
            <NavItem to="/team" icon={UserCog} label="Team Management" onClick={onClose} />
            <NavItem to="/settings/services" icon={Layers} label="Services" onClick={onClose} />
            <NavItem to="/portal-admin" icon={Globe} label="Client Portals" onClick={onClose} />
          </>
        )}
      </nav>

      {/* Bottom stats */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              Agency Mode
            </span>
          </div>
          <p className="text-xs text-slate-400">All systems operational</p>
        </div>
      </div>
    </aside>
  );
}
