// SPDX-License-Identifier: MPL-2.0
export const APP_BUILD_ID = typeof __IB_BUILD_ID__ === 'undefined' ? 'development' : __IB_BUILD_ID__;
export const BETA_REHEARSAL = typeof __IB_BETA_REHEARSAL__ !== 'undefined' && __IB_BETA_REHEARSAL__;
export const PUBLIC_BLANK = typeof __IB_PUBLIC_BLANK__ !== 'undefined' && __IB_PUBLIC_BLANK__;
export const SUPPORT_EMAIL = 'ibnotes.support@icloud.com';

export type SupportScreen = 'Settings' | 'Screen recovery' | 'Journal recovery' | 'Storage recovery';
export type ReportDetails = { happened: string; expected: string; steps: string };
export type ReportContext = { build: string; browser: string; device: string; mode: string; timeZone: string; screen: SupportScreen };

/** Parse only broad, useful facts. Never include a raw user agent, URL, or error. */
export function supportContext(input: { userAgent: string; standalone: boolean; timeZone?: string; screen: SupportScreen }): ReportContext {
  const ua = input.userAgent;
  const browser = /Edg\/(\d+(?:\.\d+)*)/.exec(ua) ?? /(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/.exec(ua)
    ?? /(?:Firefox|FxiOS)\/(\d+(?:\.\d+)*)/.exec(ua) ?? /Version\/(\d+(?:\.\d+)*)/.exec(ua);
  const name = /Edg\//.test(ua) ? 'Edge' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  const ios = /(?:CPU (?:iPhone )?OS) (\d+(?:_\d+)*)/.exec(ua);
  const android = /Android (\d+(?:\.\d+)*)/.exec(ua);
  const device = ios ? `iOS ${ios[1]!.replaceAll('_', '.')}` : android ? `Android ${android[1]}`
    : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  return { build: APP_BUILD_ID, browser: browser ? `${name} ${browser[1]}` : name, device,
    mode: input.standalone ? 'Home Screen app' : 'Browser', timeZone: input.timeZone ?? 'Not available', screen: input.screen };
}

export function formatSupportReport(details: ReportDetails, context: ReportContext | null): string {
  const sections = ['IB Notes — problem report',
    `What happened:\n${details.happened.trim() || '(not supplied)'}`,
    `What I expected:\n${details.expected.trim() || '(not supplied)'}`,
    `Steps to repeat, if known:\n${details.steps.trim() || '(not supplied)'}`];
  // Explicit allowlist. Do not serialize context or accept journal/error objects.
  if (context) sections.push(`App details:\nBuild: ${context.build}\nBrowser: ${context.browser}\nDevice: ${context.device}\nOpened as: ${context.mode}\nDisplay timezone: ${context.timeZone}\nScreen: ${context.screen}`);
  return sections.join('\n\n');
}

export function supportEmailDraft(report: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('IB Notes — problem report')}&body=${encodeURIComponent(report)}`;
}
