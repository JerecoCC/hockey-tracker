import Button, { type ButtonProps } from '@jerecocc/tracker-ui/components/Button/Button';

interface SectionActionButtonProps extends Omit<
  ButtonProps,
  'children' | 'icon' | 'iconHeight' | 'tooltip'
> {
  icon: string;
  label: string;
}

/** A section header action: an icon with its label beside it, the same size on every screen. */
const SectionActionButton = ({
  icon,
  label,
  size = 'medium',
  ...rest
}: SectionActionButtonProps) => (
  <Button
    {...rest}
    icon={icon}
    size={size}
  >
    {label}
  </Button>
);

export default SectionActionButton;
