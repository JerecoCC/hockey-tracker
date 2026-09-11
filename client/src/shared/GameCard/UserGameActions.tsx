import Button from '@jerecocc/tracker-ui/components/Button/Button';
import type { ListItemAction } from '@jerecocc/tracker-ui/components/ListItem/ListItem';
import { getUserGameActions, type UserGameActionsProps } from './userGameActionItems';

const UserGameActions = (props: UserGameActionsProps) => (
  <>
    {getUserGameActions(props)
      .filter((action): action is ListItemAction => !!action)
      .map((action) => (
        <Button
          key={action.tooltip}
          type="button"
          variant="outlined"
          intent={action.intent}
          icon={action.icon}
          tooltip={action.tooltip}
          disabled={action.disabled}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
        />
      ))}
  </>
);

export default UserGameActions;
