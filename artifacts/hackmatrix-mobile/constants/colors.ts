/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#173A36',
    tint: '#087F72',
    background: '#F3F8F6',
    foreground: '#173A36',
    card: '#FFFFFF',
    cardForeground: '#173A36',
    primary: '#087F72',
    primaryForeground: '#FFFFFF',
    secondary: '#E4F0EC',
    secondaryForeground: '#245149',
    muted: '#EAF1EF',
    mutedForeground: '#687F7A',
    accent: '#D7EAE3',
    accentForeground: '#245149',
    destructive: '#B94C52',
    destructiveForeground: '#FFFFFF',
    border: '#D9E6E1',
    input: '#D4E2DD',
    success: '#27795B',
    successSurface: '#E4F3EB',
    warning: '#986619',
    warningSurface: '#FBF1DB',
    info: '#397284',
    infoSurface: '#E6F2F5',
  },
  dark: {
    text: '#E4F2EE',
    tint: '#70C2AE',
    background: '#102622',
    foreground: '#E4F2EE',
    card: '#19352F',
    cardForeground: '#E4F2EE',
    primary: '#70C2AE',
    primaryForeground: '#102622',
    secondary: '#24443C',
    secondaryForeground: '#DCEFE8',
    muted: '#213B35',
    mutedForeground: '#A1B7AF',
    accent: '#294A40',
    accentForeground: '#DCEFE8',
    destructive: '#EF8D8D',
    destructiveForeground: '#341B1D',
    border: '#315149',
    input: '#3A5A51',
    success: '#7BD1A4',
    successSurface: '#1D4032',
    warning: '#E6BE6D',
    warningSurface: '#413721',
    info: '#8AC8DA',
    infoSurface: '#1C3A43',
  },
  radius: 16,
};

export default colors;
