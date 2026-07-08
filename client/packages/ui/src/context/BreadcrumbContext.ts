import { createContext, useContext, useEffect, type DependencyList } from 'react';
import type { BreadcrumbItem } from '../components/Breadcrumbs/Breadcrumbs';

export interface BreadcrumbConfig {
  items: BreadcrumbItem[];
  backPath?: string;
  backLabel?: string;
}

interface BreadcrumbContextValue {
  config: BreadcrumbConfig | null;
  setBreadcrumbs: (config: BreadcrumbConfig | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  config: null,
  setBreadcrumbs: () => {},
});

export const useBreadcrumbs = () => useContext(BreadcrumbContext);

export const usePageBreadcrumbs = (
  config: BreadcrumbConfig | null,
  deps: DependencyList,
) => {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs(config);
    return () => setBreadcrumbs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setBreadcrumbs, ...deps]);
};

export default BreadcrumbContext;
