import { motion } from "motion/react";

const motionPresets = {
  fadeUp: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  },
  slideLeft: {
    initial: { opacity: 0, x: 14 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 }
  },
  settle: {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 }
  }
};

const defaultTransition = { duration: 0.22, ease: "easeOut" };

function MotionSurface({ children, className, preset = "fadeUp", transition, ...props }) {
  const variants = motionPresets[preset] || motionPresets.fadeUp;

  return (
    <motion.div
      className={className}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{ ...defaultTransition, ...transition }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function MotionAside({ children, className, preset = "slideLeft", transition, ...props }) {
  const variants = motionPresets[preset] || motionPresets.slideLeft;

  return (
    <motion.aside
      className={className}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{ ...defaultTransition, ...transition }}
      {...props}
    >
      {children}
    </motion.aside>
  );
}

export { MotionAside, MotionSurface };
