'use client';

import type {ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

type IconName = 'home' | 'discover' | 'trade' | 'account' | 'bell' | 'operations' | 'arrow';
const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
  discover: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  trade: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/></>,
  account: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3ZM9 21h6"/></>,
  operations: <><path d="M4 4v16h16M8 15v-4M13 15V7M18 15v-6"/></>,
  arrow: <path d="M20 12H4m6-6-6 6 6 6"/>,
};

export function PlatformIcon({name}: {name: IconName}) {
  return <svg className="platform-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const links = [
  {href: '/', ar: 'الرئيسية', en: 'Home', icon: 'home'},
  {href: '/discover', ar: 'اكتشف', en: 'Discover', icon: 'discover'},
  {href: '/requests', ar: 'التجارة', en: 'Trade', icon: 'trade'},
  {href: '/account', ar: 'الحساب', en: 'Account', icon: 'account'},
] as const;
const tradePaths = ['/request','/offer','/commit','/execution','/documents','/receive','/reorder'];

export function PlatformHeader({actions, lang = 'ar', showOperations = false}: {actions?: ReactNode; lang?: 'ar' | 'en'; showOperations?: boolean}) {
  const pathname = (usePathname() || '/').replace(/\/+$/, '') || '/';
  const active = (href: string) => href === '/' ? pathname === '/' : href === '/requests' ? pathname === href || tradePaths.some(p => pathname === p || pathname.startsWith(p + '/')) : pathname === href || pathname.startsWith(href + '/');
  return <>
    <header className="platform-header">
      <div className="platform-header-inner">
        <Link href="/" className="platform-brand" aria-label={lang === 'ar' ? 'سبتليون — الرئيسية' : 'Septlion — Home'}>
          <picture><source media="(max-width: 600px)" srcSet="/brand/septlion-symbol-navy.svg"/><img src="/brand/septlion-wordmark-navy.svg" width="144" height="52" alt="SEPTLION"/></picture>
        </Link>
        <nav className="platform-navigation" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          {links.slice(0,3).map(link => <Link href={link.href} key={link.href} className={active(link.href) ? 'active' : undefined} aria-current={active(link.href) ? 'page' : undefined}>{link[lang]}</Link>)}
        </nav>
        <div className="platform-actions">
          <Link className="platform-action mobile-discover" href="/discover">{lang === 'ar' ? 'اكتشف' : 'Discover'}</Link>
          {actions ?? <>
            {showOperations && <Link className="platform-action" href="/operations" aria-label="العمليات"><PlatformIcon name="operations"/><span className="platform-action-label">العمليات</span></Link>}
            <Link className="platform-action" href="/notifications" aria-label={lang === 'ar' ? 'التنبيهات' : 'Notifications'}><PlatformIcon name="bell"/><span className="platform-action-label">{lang === 'ar' ? 'التنبيهات' : 'Notifications'}</span></Link>
            <Link className="platform-action" href="/account" aria-label={lang === 'ar' ? 'الحساب' : 'Account'}><PlatformIcon name="account"/><span className="platform-action-label">{lang === 'ar' ? 'الحساب' : 'Account'}</span></Link>
            <Link className="primary-link header-start" href="/require">{lang === 'ar' ? 'ابدأ طلبًا' : 'Start a requirement'}</Link>
          </>}
        </div>
      </div>
    </header>
    <nav className="platform-mobile-nav" aria-label={lang === 'ar' ? 'التنقل على الهاتف' : 'Mobile navigation'}>
      {links.map(link => <Link href={link.href} key={link.href} className={active(link.href) ? 'active' : undefined} aria-current={active(link.href) ? 'page' : undefined}><PlatformIcon name={link.icon}/><span>{link[lang]}</span></Link>)}
    </nav>
  </>;
}
