// One vector source for the header, footer, app illustration and browser icon.
// CSS variables provide a monochrome version on dark backgrounds.
export function brandMark({ standalone = false } = {}) {
  return `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg"' : 'aria-hidden="true" focusable="false"'} viewBox="0 0 48 56" fill="none">
    <path d="M24 2C19 5 11 7 6 8C4 8.5 3 10 3 12V29C3 41 12 49 22 53C23.3 53.6 24.7 53.6 26 53C36 49 45 41 45 29V12C45 10 44 8.5 42 8C37 7 29 5 24 2Z" fill="var(--brand-shield, #0D2C54)"/>
    <rect x="12" y="14" width="24" height="28" rx="6" fill="var(--brand-bus-body, #FFFFFF)"/>
    <rect x="19" y="17" width="10" height="2" rx="1" fill="var(--brand-accent, #00796B)"/>
    <rect x="15" y="21" width="18" height="10" rx="2" fill="var(--brand-shield, #0D2C54)"/>
    <path d="M24 22V30" stroke="var(--brand-bus-body, #FFFFFF)" stroke-width="2"/>
    <circle cx="17" cy="36" r="2" fill="var(--brand-shield, #0D2C54)"/>
    <circle cx="31" cy="36" r="2" fill="var(--brand-shield, #0D2C54)"/>
    <path d="M16 41V44M32 41V44" stroke="var(--brand-bus-body, #FFFFFF)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}
