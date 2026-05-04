export const fadeUp = {
  hidden: { opacity:0, y:50 },
  show:   { opacity:1, y:0, transition:{ duration:0.7, ease:[0.22,1,0.36,1] } },
}
export const fadeUpStagger = {
  hidden: {},
  show:   { transition:{ staggerChildren:0.1 } },
}
export const fadeIn = {
  hidden: { opacity:0 },
  show:   { opacity:1, transition:{ duration:0.4 } },
}
export const slideTab = {
  hidden: { opacity:0, x:14 },
  show:   { opacity:1, x:0,   transition:{ duration:0.3, ease:'easeOut' } },
  exit:   { opacity:0, x:-10, transition:{ duration:0.18 } },
}
export const pageVariants = {
  hidden: { opacity:0, y:20  },
  show:   { opacity:1, y:0,   transition:{ duration:0.45, ease:[0.22,1,0.36,1] } },
  exit:   { opacity:0, y:-16, transition:{ duration:0.25 } },
}
