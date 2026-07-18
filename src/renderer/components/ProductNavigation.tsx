import type { ReactElement } from 'react';
import { rendererText } from '../i18n';

export type ProductRoute = 'breakdown' | 'techniques' | 'originals' | 'settings';

export type ProductNavigationProps = {
  readonly activeRoute: ProductRoute;
};

export function ProductNavigation(props: ProductNavigationProps): ReactElement {
  return (
    <nav className="product-navigation" aria-label={rendererText.productNavigation.label}>
      <a href="#/" aria-current={props.activeRoute === 'breakdown' ? 'page' : undefined}>
        {rendererText.productNavigation.breakdownShelf}
      </a>
      <a
        href="#/techniques"
        aria-current={props.activeRoute === 'techniques' ? 'page' : undefined}
      >
        {rendererText.productNavigation.techniqueLibrary}
      </a>
      <a
        href="#/originals"
        aria-current={props.activeRoute === 'originals' ? 'page' : undefined}
      >
        {rendererText.productNavigation.originalShelf}
      </a>
      <a
        href="#/settings"
        aria-current={props.activeRoute === 'settings' ? 'page' : undefined}
      >
        {rendererText.productNavigation.settings}
      </a>
    </nav>
  );
}
