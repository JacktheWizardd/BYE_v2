// BYE · Design A (Spellbook) — design tokens for React Native / Expo.
// Values match design.html exactly. Import this instead of hard-coding colors or sizes.

export const colors = {
  paper: '#faf8f3',      // app background
  paper2: '#f2eee6',     // sunken panels, section cards, hover
  card: '#ffffff',       // raised cards, inputs
  tile: '#eae5db',       // format tags
  tileLine: '#ddd6c9',
  ink: '#161618',        // text, primary button, selected states
  ink2: '#6b665e',       // secondary text (5.4:1 on paper)
  line: '#e2dcd0',       // hairlines, dividers
  lineStrong: '#8c857a', // input and secondary-button borders
  highlight: '#f2c14e',  // highlighter mark, rating bars, focus glow, primary hover
  signal: '#b8401a',     // errors, "full", destructive, sparkle accent
  good: '#2f6b46',       // success text, "used" status
  statusUnusedBg: '#fdf1cf',
  statusUnusedText: '#6b4e00',
  statusUsedBg: '#e3efe7',
} as const;

export const fonts = {
  // Load with expo-font from assets/fonts (variable TTFs). On native, register one family per weight you use.
  display: 'LibreBaskerville',         // headings, scores, professor names
  displayItalic: 'LibreBaskerville-Italic', // roman numerals, kicker, signature, notes
  sans: 'SchibstedGrotesk',            // body, labels, buttons
  mono: 'JetBrainsMono',               // course codes, CRNs, invite codes
} as const;

export const type = {
  heroMobile: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontWeight: '600' },
  heroDesktop: { fontFamily: fonts.display, fontSize: 64, lineHeight: 68, letterSpacing: -1.8, fontWeight: '600' },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, fontWeight: '600' },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, fontWeight: '600' },
  h3: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, fontWeight: '600' },
  name: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.2, fontWeight: '600' },
  scoreList: { fontFamily: fonts.displayItalic, fontSize: 34, lineHeight: 34, letterSpacing: -0.8, fontWeight: '600' },
  scoreStat: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32, letterSpacing: -0.8, fontWeight: '600' },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  lead: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 26 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  button: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 20, fontWeight: '600' },
  eyebrow: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, letterSpacing: 1.4, fontWeight: '700', textTransform: 'uppercase' },
  code: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  inviteCode: { fontFamily: fonts.mono, fontSize: 22, lineHeight: 22, letterSpacing: 5, fontWeight: '500' },
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const layout = {
  gutter: 20,            // page side padding
  maxContent: 1200,      // header / page max width
  maxForm: 560,          // search, choose-profile
  maxAdmin: 760,
  listPaneDesktop: 400,  // professor list width in the desktop split
  breakpointDesktop: 1024,
  minTouch: 44,
} as const;

export const shadow = {
  card: { shadowColor: '#161618', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  pop: { shadowColor: '#161618', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
} as const;

export const motion = {
  fast: 150,     // hover/press color changes
  toastIn: 200,
  toastHold: 2600,
  // Respect AccessibilityInfo.isReduceMotionEnabled(): skip spinners/shimmer, show static text instead.
} as const;
