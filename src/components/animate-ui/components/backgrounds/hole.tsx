'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HoleBackgroundProps {
  className?: string;
}

export const HoleBackground = ({ className }: HoleBackgroundProps) => {
  return (
    <div className={cn('relative w-full h-full overflow-hidden', className)}>
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 25%),
            radial-gradient(circle at 80% 80%, rgba(74, 222, 128, 0.2), transparent 25%),
            radial-gradient(circle at 40% 20%, rgba(251, 191, 36, 0.2), transparent 20%),
            radial-gradient(circle at 90% 10%, rgba(239, 68, 68, 0.2), transparent 20%)
          `,
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Hole effect with multiple layers */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-primary/20"
            style={{
              width: `${(i + 1) * 100}px`,
              height: `${(i + 1) * 100}px`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 2.5, 2.5],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-700 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"
        style={{
          backgroundSize: '30px 30px',
          backgroundImage: `
            linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
          `,
        }}
      />
      
      {/* Center glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div 
          className="w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </motion.div>
    </div>
  );
};
