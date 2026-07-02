import { Fragment, useId, type ReactNode } from 'react';
import Chip, { type ChipSize } from '../Chip/Chip';
import Divider from '../Divider/Divider';
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar';
import RadioButton from '../RadioButton/RadioButton';
import selectableItemStyles from '../SelectableListItem/SelectableListItem.module.scss';
import TeamLogo from '../TeamLogo/TeamLogo';
import styles from './RadioList.module.scss';

export interface RadioListOptionChip {
  label: ReactNode;
  size?: ChipSize;
  primaryColor?: string | null;
  textColor?: string | null;
}

export interface RadioListOption {
  value: string;
  /** Optional small square image shown to the left of the main image. */
  leadingImage?: string | null;
  leadingImageDark?: string | null;
  leadingImageLight?: string | null;
  leadingImagePlaceholder?: string;
  leadingImagePrimaryColor?: string | null;
  leadingImageTextColor?: string | null;
  image?: string | null;
  imageDark?: string | null;
  imageLight?: string | null;
  imagePlaceholder?: string;
  imageShape?: 'square' | 'circle';
  imageBackground?: boolean;
  hideImage?: boolean;
  imagePrimaryColor?: string | null;
  imageTextColor?: string | null;
  eyebrow?: string;
  chip?: RadioListOptionChip | null;
  name: string;
  subtitle?: string;
  rightContent?: ReactNode;
  disabled?: boolean;
}

interface RadioListProps {
  value: string | null;
  onChange: (value: string) => void;
  options: RadioListOption[];
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

const RadioList = ({
  value,
  onChange,
  options,
  disabled = false,
  className,
  ariaLabel,
  ariaLabelledBy,
}: RadioListProps) => {
  const baseId = useId();

  const selectOption = (option: RadioListOption) => {
    if (disabled || option.disabled || value === option.value) return;
    onChange(option.value);
  };

  return (
    <ul
      className={[styles.list, className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-orientation="vertical"
      aria-disabled={disabled || undefined}
    >
      {options.map((option, index) => {
        const checked = value === option.value;
        const optionDisabled = disabled || Boolean(option.disabled);
        const labelId = `${baseId}-${index}`;

        return (
          <Fragment key={option.value}>
            {index > 0 && (
              <li
                className={styles.dividerItem}
                role="presentation"
                aria-hidden="true"
              >
                <Divider className={styles.itemDivider} />
              </li>
            )}
            <li
              className={[
                selectableItemStyles.item,
                styles.option,
                checked ? selectableItemStyles.checked : '',
                checked ? styles.checked : '',
                optionDisabled ? selectableItemStyles.disabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-radio-list-option="true"
              aria-disabled={optionDisabled}
              onClick={optionDisabled ? undefined : () => selectOption(option)}
            >
              <span className={selectableItemStyles.selectionRegion}>
                <span className={selectableItemStyles.checkRegion}>
                  <RadioButton
                    checked={checked}
                    onChange={() => selectOption(option)}
                    disabled={optionDisabled}
                    ariaLabelledBy={labelId}
                  />
                </span>
                <Divider
                  variant="vertical"
                  className={selectableItemStyles.divider}
                />
              </span>

              {(option.leadingImage || option.leadingImagePlaceholder) &&
                (option.leadingImage ? (
                  <TeamLogo
                    logo={option.leadingImage}
                    logoDark={option.leadingImageDark}
                    logoLight={option.leadingImageLight}
                    code={option.leadingImagePlaceholder ?? ''}
                    alt=""
                    size={34}
                    shape="square"
                    primaryColor={option.leadingImagePrimaryColor}
                    textColor={option.leadingImageTextColor}
                    className={selectableItemStyles.leadingLogo}
                  />
                ) : (
                  <span
                    className={selectableItemStyles.leadingLogoPlaceholder}
                    style={
                      option.leadingImagePrimaryColor
                        ? {
                            background: option.leadingImagePrimaryColor,
                            color: option.leadingImageTextColor ?? undefined,
                          }
                        : undefined
                    }
                  >
                    {option.leadingImagePlaceholder}
                  </span>
                ))}

              {!option.hideImage && option.imageShape !== 'circle' && (
                <TeamLogo
                  logo={option.image}
                  logoDark={option.imageDark}
                  logoLight={option.imageLight}
                  code={option.imagePlaceholder ?? ''}
                  alt=""
                  size={32}
                  shape="square"
                  primaryColor={option.imagePrimaryColor}
                  textColor={option.imageTextColor}
                  className={[
                    selectableItemStyles.image,
                    selectableItemStyles.square,
                    option.image && option.imageBackground === false
                      ? selectableItemStyles.imageTransparent
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}

              {!option.hideImage && option.imageShape === 'circle' && (
                <PlayerAvatar
                  photo={option.image}
                  initials={option.imagePlaceholder ?? ''}
                  primaryColor={
                    !option.image || option.imageBackground !== false
                      ? option.imagePrimaryColor
                      : null
                  }
                  textColor={option.imageTextColor}
                  size={48}
                  className={selectableItemStyles.playerAvatar}
                />
              )}

              {option.chip && (
                <Chip
                  size={option.chip.size}
                  primaryColor={option.chip.primaryColor}
                  textColor={option.chip.textColor}
                >
                  {option.chip.label}
                </Chip>
              )}

              <div className={selectableItemStyles.info}>
                {option.eyebrow && (
                  <span className={selectableItemStyles.eyebrow}>{option.eyebrow}</span>
                )}
                <div
                  id={labelId}
                  className={selectableItemStyles.name}
                >
                  {option.name}
                </div>
                {option.subtitle && (
                  <div className={selectableItemStyles.subtitle}>{option.subtitle}</div>
                )}
              </div>

              {option.rightContent}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
};

export default RadioList;
