"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOutIcon,
  Users,
  type LucideIcon,
} from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { initialsFromEmail } from "@/lib/user-display";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    isActive: (p) => p === "/dashboard" || p === "/",
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    icon: CreditCard,
    isActive: (p) => p.startsWith("/dashboard/payments"),
  },
  {
    href: "/dashboard/tenants",
    label: "Tenant history",
    icon: Users,
    isActive: (p) => p.startsWith("/dashboard/tenants"),
  },
];

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const initials = initialsFromEmail(userEmail);
  const profileActive = pathname.startsWith("/dashboard/profile");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b-2 border-sidebar-border/90 group-data-[collapsible=icon]:border-sidebar-foreground/20 dark:border-sidebar-border dark:group-data-[collapsible=icon]:border-sidebar-foreground/25">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 gap-3 px-3 py-2 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:min-h-11 group-data-[collapsible=icon]:min-w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-2!"
              render={<Link href="/dashboard" />}
              tooltip="RZen Rental · Dashboard"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:shadow-md">
                <Building2
                  className="size-[18px] shrink-0 group-data-[collapsible=icon]:size-4.5"
                  aria-hidden
                />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold tracking-tight">
                  RZen Rental
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Bohol · rooms & payments
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      className="group-data-[collapsible=icon]:rounded-lg"
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-2 border-sidebar-border/90 group-data-[collapsible=icon]:border-sidebar-foreground/20 dark:border-sidebar-border dark:group-data-[collapsible=icon]:border-sidebar-foreground/25">
        <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              isActive={profileActive}
              className="gap-3 rounded-lg group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
              render={<Link href="/dashboard/profile" />}
              tooltip="Your account"
            >
              <Avatar
                size="sm"
                className="size-8 shrink-0 rounded-lg ring-1 ring-sidebar-border group-data-[collapsible=icon]:size-9"
              >
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">Your account</span>
                <span
                  className="truncate text-xs text-sidebar-foreground/70"
                  title={userEmail}
                >
                  {userEmail}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <SignOutButton className="h-9 w-full min-w-0 shrink-0 justify-center border-sidebar-border bg-sidebar-accent/40 px-3 text-sidebar-foreground hover:bg-sidebar-accent/70 dark:hover:bg-sidebar-accent/60" />
          </SidebarMenuItem>

          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <form action={signOutAction} className="w-full">
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-11 w-full rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Sign out"
              >
                <LogOutIcon className="size-4.5" aria-hidden />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
