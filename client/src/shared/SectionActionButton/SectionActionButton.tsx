import Button, { type ButtonProps } from '@jerecocc/tracker-ui/components/Button/Button';
import useScreenSize from '@/hooks/useScreenSize';

interface SectionActionButtonProps
  extends Omit<ButtonProps, 'children' | 'icon' | 'iconHeight' | 'tooltip'> {
  icon: string;
  label: string;
}

/**
 * A section header action. Shows its label beside the icon, except on phones,
 * where it is an icon button with the label as its tooltip.
 */
const SectionActionButton = ({ icon, label, size = 'medium', ...rest }: SectionActionButtonProps) => {
  const isMobileView = useScreenSize() === 'mobile';

  if (isMobileView) {
    return (
      <Button
        {...rest}
        icon={icon}
        size={size}
        iconHeight="button"
        tooltip={label}
        aria-label={label}
      />
    );
  }

  return (
    <Button
      {...rest}
      icon={icon}
      size={size}
    >
      {label}
    </Button>
  );
};

export default SectionActionButton;
