'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
}

export function Card({ children, className, onClick, animate = false }: CardProps) {
  const Comp = animate ? motion.div : 'div';
  const animateProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <Comp
      className={cn(
        'bg-white rounded-2xl p-4 card-shadow',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className
      )}
      onClick={onClick}
      {...animateProps}
    >
      {children}
    </Comp>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-white',
  success: 'bg-success-50',
  warning: 'bg-warning-50',
  danger: 'bg-danger-50',
};

const variantIconBg = {
  default: 'bg-gray-100',
  success: 'bg-success-100',
  warning: 'bg-warning-100',
  danger: 'bg-danger-100',
};

const variantIconColor = {
  default: 'text-gray-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          {trend && (
            <div className={cn(
              'mt-2 inline-flex items-center text-sm font-medium',
              trend.isPositive ? 'text-success-600' : 'text-danger-600'
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span className="ml-1">{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            'p-2 rounded-xl',
            variantIconBg[variant]
          )}>
            <div className={cn('w-6 h-6', variantIconColor[variant])}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
