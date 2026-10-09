import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { SocketStatusBadge, PrivacyThresholdBadge, DemoDataBadge } from '../common/DataBadges';
import { isDemoMode, setDemoMode } from '../../services/adminService';
import {
  Activity,
  TrendingUp,
  MapPin,
  PieChart,
  ShieldCheck,
  FileText,
  ShieldAlert,
  Menu,
  X,
  User,
  LogOut,
  Hospital,
  ChevronRight,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { status, lastEventTime } = useSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoActive, setDemoActive] = useState<boolean>(isDemoMode());

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: Activity, desc: 'Public health KPI & trend overview' },
    { path: '/trends', label: 'Surveillance Trends', icon: TrendingUp, desc: 'Monthly disease trend analysis' },
    { path: '/regions', label: 'Regional Surveillance', icon: MapPin, desc: 'State & district aggregates' },
    { path: '/conditions', label: 'Condition Categories', icon: PieChart, desc: 'Disease category metrics' },
    { path: '/privacy', label: 'Privacy & Governance', icon: ShieldCheck, desc: 'K=10 Anonymization policy' },
    { path: '/audit', label: 'Audit Logs', icon: FileText, desc: 'Administrative action audit' },
    { path: '/security', label: 'Security Events', icon: ShieldAlert, desc: 'Authorization & security posture' },
  ];

  const handleToggleDemoMode = () => {
    const nextState = !demoActive;
    setDemoMode(nextState);
    setDemoActive(nextState);
    window.location.reload();
  };

  const currentRoute = navItems.find((n) => n.path === location) || navItems[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                <Hospital className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  HackMatrix <span className="text-teal-400 font-medium text-xs px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-800">Admin</span>
                </span>
                <p className="text-[10px] text-slate-400 font-normal leading-none hidden sm:block">Public Health Aggregate Analytics Platform</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {demoActive && <DemoDataBadge onToggle={handleToggleDemoMode} />}
            <div className="hidden lg:flex items-center gap-2">
              <PrivacyThresholdBadge />
              <SocketStatusBadge status={status} lastUpdated={lastEventTime} />
            </div>

            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-semibold text-slate-200">{user.name}</p>
                  <p className="text-[10px] text-teal-400 font-medium">{user.role}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidebar Navigation */}
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs sticky top-22 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              Analytics & Governance
            </div>
            {navItems.map((item) => {
              const isActive = location === item.path || (location === '/' && item.path === '/dashboard');
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-teal-50 text-teal-900 font-semibold border-l-3 border-teal-600 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-600" />}
                  </div>
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-100 px-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500">
                <p className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  Aggregate Privacy Guard
                </p>
                <p className="leading-relaxed">All metrics enforce minimum group size K=10 threshold. Patient records are never queried or stored by Admin Web.</p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Menu */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end" onClick={() => setMobileOpen(false)}>
            <div className="bg-white rounded-t-2xl p-5 space-y-2 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Public Health Admin Navigation</h3>
                <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {navItems.map((item) => {
                const isActive = location === item.path;
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                        isActive ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                      <div>
                        <p>{item.label}</p>
                        <p className="text-xs text-slate-400 font-normal">{item.desc}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Page Content */}
        <main className="flex-1 min-w-0">
          {/* Breadcrumb Header */}
          <div className="mb-6 pb-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{currentRoute.label}</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{currentRoute.desc}</p>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <SocketStatusBadge status={status} lastUpdated={lastEventTime} />
            </div>
          </div>

          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200/80 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© 2026 HackMatrix Public Health Intelligence System. Authorized Administrative Access Only.</p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>HIPAA Compliant Anonymization</span>
            <span>•</span>
            <span>Minimum Group K=10</span>
            <span>•</span>
            <span>Express + TS Backend</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
