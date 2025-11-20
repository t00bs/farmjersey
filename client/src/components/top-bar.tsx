import { useAuth } from "@/hooks/useAuth";
import { Bell, ChevronDown, User, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, Link } from "wouter";

export default function TopBar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const getBreadcrumbs = () => {
    if (location === "/") {
      return [
        { label: "Home", href: "/" },
        { label: "Grant Applications", current: true },
      ];
    }
    
    if (location === "/settings") {
      return [
        { label: "Home", href: "/" },
        { label: "Settings", current: true },
      ];
    }
    
    if (location.startsWith("/application/")) {
      return [
        { label: "Home", href: "/" },
        { label: "Grant Applications", href: "/" },
        { label: "RSS Grant Application", current: true },
      ];
    }

    return [{ label: "Home", current: true }];
  };

  const breadcrumbs = getBreadcrumbs();
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : "User";
  
  // Get user initials for avatar
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList className="gap-2">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {breadcrumb.current ? (
                    <BreadcrumbPage className="font-medium">
                      {breadcrumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={breadcrumb.href} className="hover:text-text-primary">
                      {breadcrumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {/* User Profile Section */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-gray-400" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#237804]"></span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 hover:bg-gray-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{userName}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <Link href="/settings">
                <DropdownMenuItem data-testid="menu-settings">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => window.location.href = '/api/logout'}
                className="text-red-600"
                data-testid="menu-logout"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
