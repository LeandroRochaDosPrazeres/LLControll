'use client';

import { useState, useRef, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2, Edit, ShoppingCart } from 'lucide-react';
import { cn, hapticFeedback } from '@/lib/utils/helpers';

interface SwipeAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant: 'danger' | 'primary' | 'success';
}

interface SwipeableItemProps {
  children: ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  onSell?: () => void;
  className?: string;
}

const ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = 60;

export function SwipeableItem({
  children,
  onDelete,
  onEdit,
  onSell,
  className,
}: SwipeableItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const x = useMotionValue(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const actions: SwipeAction[] = [];
  
  if (onSell) {
    actions.push({
      icon: <ShoppingCart className="w-5 h-5" />,
      label: 'Vender',
      onClick: onSell,
      variant: 'success',
    });
  }
  
  if (onEdit) {
    actions.push({
      icon: <Edit className="w-5 h-5" />,
      label: 'Editar',
      onClick: onEdit,
      variant: 'primary',
    });
  }

  if (onDelete) {
    actions.push({
      icon: <Trash2 className="w-5 h-5" />,
      label: 'Excluir',
      onClick: onDelete,
      variant: 'danger',
    });
  }

  const maxDrag = actions.length * ACTION_WIDTH;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const shouldOpen = info.offset.x < -SWIPE_THRESHOLD;
    setIsOpen(shouldOpen);
    
    if (shouldOpen && Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      hapticFeedback('light');
    }
  };

  const variantColors = {
    danger: 'bg-danger-500 text-white',
    primary: 'bg-primary-500 text-white',
    success: 'bg-success-500 text-white',
  };

  return (
    <div ref={constraintsRef} className={cn('relative overflow-hidden', className)}>
      {/* Actions background */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        {actions.map((action, index) => (
          <motion.button
            key={index}
            onClick={() => {
              hapticFeedback('medium');
              action.onClick();
              setIsOpen(false);
            }}
            className={cn(
              'flex flex-col items-center justify-center',
              variantColors[action.variant]
            )}
            style={{ width: ACTION_WIDTH }}
          >
            {action.icon}
            <span className="text-xs mt-1">{action.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -maxDrag, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: isOpen ? -maxDrag : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ x }}
        className="relative bg-white"
      >
        {children}
      </motion.div>
    </div>
  );
}
