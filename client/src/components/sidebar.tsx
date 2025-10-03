import { Home, FileText, HelpCircle, Settings, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logoPath from "@assets/FJ Brand Logo_1759502325451.png";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Grant Applications", href: "/", icon: FileText },
  { name: "Admin Dashboard", href: "/admin", icon: Shield },
];

const bottomNavigation = [
  { name: "Support", href: "/support", icon: HelpCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer">
            <img src={logoPath} alt="Farm Jersey" className="h-8" data-testid="logo-sidebar" />
          </div>
        </Link>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || 
            (item.name === "Grant Applications" && location.startsWith("/application"));
          
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                isActive
                  ? "bg-primary-custom/10 text-primary-custom font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-text-primary"
              )}>
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {bottomNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <div className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-text-primary transition-colors cursor-pointer">
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
