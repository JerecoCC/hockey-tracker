import { useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import TitleRow from '../TitleRow/TitleRow';
import { useBreadcrumbs } from '../../context/BreadcrumbContext';
import Breadcrumbs from './Breadcrumbs';

const BreadcrumbTitleRow = () => {
  const { config } = useBreadcrumbs();
  const navigate = useNavigate();

  if (!config || (!config.backPath && config.items.length === 0)) return null;

  return (
    <TitleRow
      left={
        config.backPath ? (
          <Button
            variant="outlined"
            intent="neutral"
            icon="arrow_back"
            tooltip={config.backLabel ?? 'Back'}
            aria-label={config.backLabel ?? 'Back'}
            onClick={() => navigate(config.backPath!)}
          />
        ) : undefined
      }
      right={
        config.items.length > 0 ? (
          <Breadcrumbs
            items={config.items}
            linkMode="button"
          />
        ) : undefined
      }
    />
  );
};

export default BreadcrumbTitleRow;
