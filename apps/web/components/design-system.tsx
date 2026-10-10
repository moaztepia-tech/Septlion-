'use client';

import type {AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode} from 'react';

export function DesignLayers({sheen = false}: {sheen?: boolean}) {
  return <><span className="edge" aria-hidden="true"/><span className="inner-edge" aria-hidden="true"/><span className="fill" aria-hidden="true"/>{sheen && <span className="sheen" aria-hidden="true"/>}</>;
}

export function DesignButton({children, className = '', ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const secondary = /secondary|platform-action/.test(className);
  return <button {...props} className={'btn ' + (secondary ? 'secondary ' : '') + className}><DesignLayers/><span className="label">{children}</span></button>;
}

export function DesignLink({children, className = '', ...props}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={props.href} className={'btn ' + (/secondary/.test(className) ? 'secondary ' : '') + className}><DesignLayers/><span className="label">{children}</span></a>;
}

export function DesignCard({children, className = ''}: {children: ReactNode; className?: string}) {
  return <section className={'card layer-4 ' + className}><DesignLayers sheen/><div className="card-content">{children}</div></section>;
}
