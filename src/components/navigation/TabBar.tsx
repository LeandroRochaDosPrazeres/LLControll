'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings 
} from 'lucide-react';

const tabs = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/estoque', icon: Package, label: 'Estoque' },
  { href: '/vendas', icon: ShoppingCart, label: 'Vendas' },
  { href: '/ajustes', icon: Settings, label: 'Ajustes' },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Glassmorphism background */}
      <div className="glass border-t border-gray-200/50">
        <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center py-2 px-4 min-w-[64px] press-effect"
              >
                <motion.div
                  className="relative"
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute -inset-2 bg-primary-100 rounded-xl"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`relative w-6 h-6 transition-colors ${
                      isActive ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  />
                </motion.div>
                <span
                  className={`mt-1 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary-600' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
