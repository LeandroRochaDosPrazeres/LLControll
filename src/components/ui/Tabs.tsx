'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface TabsProps {
  tabs: { value: string; label: string }[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Tabs({ tabs, defaultValue, value, onValueChange, children }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue || tabs[0]?.value);
  const currentValue = value ?? activeTab;

  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsPrimitive.Root value={currentValue} onValueChange={handleValueChange}>
      <TabsPrimitive.List className="flex bg-gray-100 p-1 rounded-xl mb-4">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'relative flex-1 py-2 px-4 text-sm font-medium rounded-lg',
              'transition-colors duration-200',
              'focus:outline-none',
              currentValue === tab.value ? 'text-gray-900' : 'text-gray-500'
            )}
          >
            {currentValue === tab.value && (
              <motion.div
                layoutId="activeTabBg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

interface TabContentProps {
  value: string;
  children: React.ReactNode;
}

export function TabContent({ value, children }: TabContentProps) {
  return (
    <TabsPrimitive.Content value={value} asChild>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </TabsPrimitive.Content>
  );
}
