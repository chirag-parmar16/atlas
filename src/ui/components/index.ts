/**
 * Atlas UI — Components Barrel Export
 * 
 * New architecture: each component is a proper TypeScript function
 * that builds an injectable script string. Same visual output,
 * structured code underneath.
 */

// Shell components
export { UI_SHELL, buildShellScript } from './shell';
export { LOADER, buildLoaderScript } from './loader';
export { CLOSER, buildCloserScript } from './closer';

// Tab components  
export { LINKS, buildLinksScript } from './links';
export { RECORDER, buildRecorderScript } from './recorder';
export { EXTRAS, buildExtrasScript } from './extras';
export { CONSOLE_TOOL, buildConsoleScript } from './console';
export { NETWORKS, buildNetworksScript } from './networks';
export { APPLICATION, buildApplicationScript } from './application';
export { STORAGE, buildStorageScript } from './storage';
export { STABILITY, buildStabilityScript } from './stability';
export { SECURITY_MONITOR, buildSecurityScript } from './security-monitor';
