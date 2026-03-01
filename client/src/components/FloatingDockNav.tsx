'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { FloatingDock, DockItem } from '@/components/ui/floating-dock';
import {
  LayoutDashboard, Upload, LogOut, Sun, Moon, BookOpen, User,
} from 'lucide-react';

export default function FloatingDockNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  // Hide dock on fullscreen pages
  const hiddenRoutes = ['/teleprompter'];
  if (hiddenRoutes.some((r) => pathname.startsWith(r))) return null;

  const items: DockItem[] = [
    {
      title: 'Scriptum',
      icon: <BookOpen className="h-full w-full" />,
      href: '/dashboard',
    },
    {
      title: 'Dashboard',
      icon: <LayoutDashboard className="h-full w-full" />,
      href: '/dashboard',
      active: pathname === '/dashboard',
    },
    {
      title: 'Upload',
      icon: <Upload className="h-full w-full" />,
      href: '/upload',
      active: pathname === '/upload',
    },
    {
      title: user.name ?? 'Account',
      icon: <User className="h-full w-full" />,
      href: '#',
    },
    {
      title: theme === 'dark' ? 'Light mode' : 'Dark mode',
      icon: theme === 'dark'
        ? <Sun className="h-full w-full" />
        : <Moon className="h-full w-full" />,
      onClick: toggleTheme,
    },
    {
      title: 'Sign out',
      icon: <LogOut className="h-full w-full" />,
      onClick: () => { logout(); router.push('/login'); },
    },
  ];

  return <FloatingDock items={items} />;
}
