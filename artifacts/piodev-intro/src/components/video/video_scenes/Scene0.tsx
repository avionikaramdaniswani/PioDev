import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export default function Scene0() {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center"
      {...sceneTransitions.fadeBlur}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.5, filter: 'blur(20px)' }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-center w-full h-full"
      >
        <div className="text-[12vw] font-mono text-primary font-bold tracking-tighter flex items-center">
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {'>'}
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse' }}
            className="ml-[1vw] text-secondary"
          >
            _
          </motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
}
