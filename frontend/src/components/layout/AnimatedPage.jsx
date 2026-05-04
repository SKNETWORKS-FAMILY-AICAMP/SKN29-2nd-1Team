import { motion } from 'framer-motion'
import { pageVariants } from '../../animations/variants'

export default function AnimatedPage({ children, pageKey }) {
  return (
    <motion.main
      key={pageKey}
      className="yta-page-transition"
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </motion.main>
  )
}
