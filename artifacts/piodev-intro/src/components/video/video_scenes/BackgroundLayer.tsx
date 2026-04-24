import { motion } from 'framer-motion';

export default function BackgroundLayer({ currentScene }: { currentScene: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Ambient blobs */}
      <motion.div 
        className="absolute -top-[30vw] -left-[30vw] w-[70vw] h-[70vw] rounded-full bg-primary/10 blur-[100px]"
        animate={{
          x: currentScene === 0 ? 0 : currentScene === 1 ? '20vw' : currentScene === 2 ? '40vw' : 0,
          y: currentScene === 0 ? 0 : currentScene === 1 ? '10vw' : currentScene === 2 ? '-10vw' : 0,
          scale: currentScene === 1 ? 1.5 : currentScene === 2 ? 2 : 1,
          opacity: currentScene === 2 ? 0.3 : 0.5,
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
      />
      
      <motion.div 
        className="absolute top-[20vh] -right-[20vw] w-[50vw] h-[50vw] rounded-full bg-secondary/10 blur-[120px]"
        animate={{
          x: currentScene === 0 ? 0 : currentScene === 1 ? '-20vw' : currentScene === 2 ? '-40vw' : 0,
          y: currentScene === 0 ? 0 : currentScene === 1 ? '20vh' : currentScene === 2 ? '10vh' : 0,
          scale: currentScene === 2 ? 1.8 : 1,
          opacity: currentScene === 0 ? 0.2 : 0.6,
        }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      />

      <motion.div 
        className="absolute -bottom-[20vh] left-[20vw] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[100px]"
        animate={{
          x: currentScene === 2 ? '20vw' : currentScene === 3 ? '0vw' : '-10vw',
          y: currentScene === 2 ? '-30vh' : 0,
          scale: currentScene === 3 ? 1.5 : 1,
          opacity: currentScene === 3 ? 0.5 : 0.3,
        }}
        transition={{ duration: 3.5, ease: 'easeInOut' }}
      />
      
      {/* Grid pattern overlay */}
      <motion.div 
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(circle at center, transparent 0%, var(--color-bg-dark) 100%), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 4vw 4vw, 4vw 4vw'
        }}
        animate={{
          opacity: currentScene === 2 ? 0.4 : 0.15,
          scale: currentScene === 2 ? 1.1 : 1
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
    </div>
  );
}
