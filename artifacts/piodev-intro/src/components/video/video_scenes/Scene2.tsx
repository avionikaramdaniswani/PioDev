import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { Terminal } from 'lucide-react';

const mockCode = [
  "const [data, setData] = useState<Code[]>([]);",
  "useEffect(() => {",
  "  async function fetchCode() {",
  "    const res = await api.generate({ context: 'ui' });",
  "    setData(res.components);",
  "  }",
  "  fetchCode();",
  "}, []);"
];

export default function Scene2() {

  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center perspective-[2000px]"
      {...sceneTransitions.fadeBlur}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1 }}
    >
      <div className="relative w-[70vw] h-[60vh]">
        {/* Floating background elements for this scene */}
        <motion.div
          className="absolute -top-[10vh] -left-[10vw] w-[30vw] h-[30vw] rounded-full border-[1px] border-primary/20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: 90 }}
          transition={{ duration: 3, ease: "easeOut" }}
        />
        <motion.div
          className="absolute -bottom-[10vh] -right-[10vw] w-[40vw] h-[40vw] rounded-full border-[1px] border-accent/20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: -90 }}
          transition={{ duration: 3, ease: "easeOut", delay: 0.2 }}
        />

        {/* Main code interface panel */}
        <motion.div
          className="absolute top-0 left-0 w-full h-full glass-panel rounded-[2vw] p-[3vw] flex flex-col shadow-2xl"
          initial={{ opacity: 0, rotateX: 20, y: 50, z: -100 }}
          animate={{ opacity: 1, rotateX: 0, y: 0, z: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          <div className="flex items-center gap-[1vw] mb-[3vh] pb-[2vh] border-b border-white/10">
            <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-error" />
            <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-warning" />
            <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-success" />
            <span className="ml-[1vw] text-[1.5vw] text-text-muted font-mono">PioDev Chat</span>
          </div>

          <div className="flex-1 flex flex-col gap-[3vh] overflow-hidden">
            {/* User Message */}
            <motion.div 
              className="self-end bg-primary/20 border border-primary/20 rounded-[1.5vw] rounded-tr-[0.5vw] px-[2vw] py-[1.5vh] max-w-[80%]"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            >
              <p className="text-[2vw] text-text-primary">Tolong buatkan komponen React untuk fetch data.</p>
            </motion.div>

            {/* AI Response */}
            <motion.div 
              className="flex gap-[1.5vw] max-w-[90%]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
            >
              <div className="w-[3.5vw] h-[3.5vw] rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-[0.5vh]">
                <Terminal className="w-[1.8vw] h-[1.8vw] text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-[1.5vw] rounded-tl-[0.5vw] p-[2vw] flex-1">
                <p className="text-[1.8vw] text-text-secondary mb-[2vh]">Ini contoh implementasinya menggunakan hooks:</p>
                <div className="bg-black/50 rounded-[1vw] p-[2vw] font-mono text-[1.6vw] leading-[1.6]">
                  {mockCode.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 1.3 + 0.1 * i }}
                      className={`${line.includes('const') || line.includes('function') ? 'text-primary' : line.includes('useState') || line.includes('useEffect') ? 'text-secondary' : 'text-text-muted'}`}
                    >
                      {line}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
