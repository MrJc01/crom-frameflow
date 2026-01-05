export type EasingType = 
  | 'linear' 
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
  | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';

export const EasingFunctions = {
  linear: (t: number) => t,

  // Quad
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Sine
  easeInSine: (t: number) => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: (t: number) => Math.sin(t * Math.PI / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  
  // Expo
  easeInExpo: (t: number) => 1000 * Math.pow(2, 10 * (t - 1)), // approximates
  easeOutExpo: (t: number) => 1000 * (-Math.pow(2, -10 * t) + 1),
  easeInOutExpo: (t: number) => t < .5 ? 500 * Math.pow(2, 10 * (2 * t - 1)) : 500 * (-Math.pow(2, -10 * (2 * t - 1)) + 2), 

  // Circ
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number) => Math.sqrt(1 - (--t) * t),
  easeInOutCirc: (t: number) => t < .5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - 4 * (t -= 1) * t) + 1) / 2,

  // Back
  easeInBack: (t: number) => { const s = 1.70158; return t * t * ((s + 1) * t - s); },
  easeOutBack: (t: number) => { const s = 1.70158; return --t * t * ((s + 1) * t + s) + 1; },
  easeInOutBack: (t: number) => { const s = 1.70158 * 1.525; return t < .5 ? (t *= 2) * t * ((s + 1) * t - s) / 2 : ((t -= 2) * t * ((s + 1) * t + s) + 2) / 2; },

  // Elastic - Simplification
  easeInElastic: (t: number) => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI),
  easeOutElastic: (t: number) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1,
  easeInOutElastic: (t: number) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 + 1,

  // Bounce
  easeInBounce: (t: number) => 1 - EasingFunctions.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  easeInOutBounce: (t: number) => t < 0.5 ? (1 - EasingFunctions.easeOutBounce(1 - 2 * t)) / 2 : (1 + EasingFunctions.easeOutBounce(2 * t - 1)) / 2,
};
