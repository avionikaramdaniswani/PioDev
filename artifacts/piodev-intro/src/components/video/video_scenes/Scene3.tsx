import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { Terminal } from 'lucide-react';

export default function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      {...sceneTransitions.zoomThrough}
      exit={{ opacity: 0, scale: 1.5 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="flex flex-col items-center text-center"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.15, opacity: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="w-[10vw] h-[10vw] bg-gradient-to-br from-primary to-secondary rounded-[2vw] flex items-center justify-center shadow-2xl shadow-primary/40 mb-[4vh]"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 }}
        >
          <Terminal className="w-[5vw] h-[5vw] text-white" />
        </motion.div>

        <motion.h2
          className="text-[8vw] font-bold tracking-tight mb-[2vh]"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.5 }}
        >
          <span
            style={{
              background: 'linear-gradient(to right, #7c6ef0, #818cf8, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            PioDev
          </span>
        </motion.h2>

        <motion.p
          className="text-[2.5vw] text-text-secondary tracking-wide font-mono"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
        >
          teman ngoding yang selalu siap
        </motion.p>

        <motion.div
          className="mt-[5vh] flex items-center gap-[1vw]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.5 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-[1vw] h-[1vw] rounded-full bg-primary"
              animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
