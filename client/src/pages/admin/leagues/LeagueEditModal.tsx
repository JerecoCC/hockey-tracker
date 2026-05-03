import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Field from '@/components/Field/Field';
import Icon from '@/components/Icon/Icon';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import Modal from '@/components/Modal/Modal';
import { type LeagueFullRecord } from '@/hooks/useLeagueDetails';
import { type CreateLeagueData, type PlayoffFormatRule } from '@/hooks/useLeagues';
import styles from './LeagueEditModal.module.scss';

const SCOPE_OPTIONS: { value: PlayoffFormatRule['scope']; label: string }[] = [
  { value: 'league', label: 'Whole League' },
  { value: 'conference', label: 'Per Conference' },
  { value: 'division', label: 'Per Division' },
];
const METHOD_OPTIONS: { value: PlayoffFormatRule['method']; label: string }[] = [
  { value: 'top', label: 'Top N (direct)' },
  { value: 'wildcard', label: 'Wildcard (best remaining)' },
];

const BEST_OF_OPTIONS = [
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

const SHOOTOUT_OPTIONS = [
  { value: '3', label: '3 rounds' },
  { value: '5', label: '5 rounds' },
  { value: '7', label: '7 rounds' },
];

const SCORING_SYSTEM_OPTIONS = [
  { value: '2-1-0', label: '2-1-0 (W / OT Loss / Loss)' },
  { value: '3-2-1-0', label: '3-2-1-0 (W / OT W / OT Loss / Loss)' },
];

interface FormValues {
  logo: File | string | null;
  name: string;
  code: string;
  primary_color: string;
  text_color: string;
  description: string | null;
  best_of_playoff: string;
  best_of_shootout: string;
  scoring_system: '3-2-1-0' | '2-1-0';
}

const normalizeDescription = (html: string | null | undefined): string | null => {
  if (!html || html === '<p></p>') return null;
  return html;
};

interface Props {
  open: boolean;
  league: LeagueFullRecord;
  uploadLogo: (file: File) => Promise<string | null>;
  updateLeague: (id: string, data: Partial<CreateLeagueData>) => Promise<boolean>;
  onClose: () => void;
}

const LeagueEditModal = ({ open, league, uploadLogo, updateLeague, onClose }: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      logo: null,
      name: '',
      code: '',
      primary_color: '#334155',
      text_color: '#ffffff',
      description: null,
      best_of_playoff: '7',
      best_of_shootout: '3',
      scoring_system: '2-1-0' as const,
    },
  });

  const [formatRules, setFormatRules] = useState<PlayoffFormatRule[]>([]);

  useEffect(() => {
    if (!open) return;
    reset({
      logo: league.logo ?? null,
      name: league.name,
      code: league.code,
      primary_color: league.primary_color,
      text_color: league.text_color,
      description: league.description ?? null,
      best_of_playoff: String(league.best_of_playoff ?? 7),
      best_of_shootout: String(league.best_of_shootout ?? 3),
      scoring_system: league.scoring_system ?? '2-1-0',
    });
    setFormatRules(league.playoff_format ?? []);
  }, [open, league, reset]);

  const addRule = () =>
    setFormatRules((prev) => [...prev, { scope: 'league', method: 'top', count: 4 }]);

  const updateRule = (idx: number, patch: Partial<PlayoffFormatRule>) =>
    setFormatRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeRule = (idx: number) => setFormatRules((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = handleSubmit(async (data) => {
    let logoUrl: string | null = typeof data.logo === 'string' ? data.logo : null;
    if (data.logo instanceof File) {
      const url = await uploadLogo(data.logo);
      if (!url) return;
      logoUrl = url;
    }
    const payload: Partial<CreateLeagueData> = {
      logo: logoUrl,
      name: data.name,
      code: data.code,
      primary_color: data.primary_color,
      text_color: data.text_color,
      description: normalizeDescription(data.description) ?? undefined,
      best_of_playoff: parseInt(data.best_of_playoff, 10),
      best_of_shootout: parseInt(data.best_of_shootout, 10),
      scoring_system: data.scoring_system,
      playoff_format: formatRules.length > 0 ? formatRules : null,
    };
    const ok = await updateLeague(league.id, payload);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      title="Edit League"
      onClose={onClose}
      confirmLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      confirmForm="league-edit-form"
      confirmDisabled={isSubmitting}
      busy={isSubmitting}
    >
      <form
        id="league-edit-form"
        className={styles.form}
        onSubmit={onSubmit}
      >
        <LogoUpload
          control={control}
          name="logo"
          label="Logo"
          disabled={isSubmitting}
        />
        <Field
          label="Name"
          required
          control={control}
          name="name"
          rules={{ required: true }}
          placeholder="e.g. National Hockey League"
          autoFocus
          disabled={isSubmitting}
        />
        <Field
          label="Code"
          required
          control={control}
          name="code"
          rules={{ required: true }}
          transform={(v) => v.toUpperCase()}
          placeholder="e.g. NHL"
          disabled={isSubmitting}
        />
        <div className={styles.colorRow}>
          <Field
            label="Primary Color"
            type="color"
            control={control}
            name="primary_color"
            disabled={isSubmitting}
          />
          <Field
            label="Text Color"
            type="color"
            control={control}
            name="text_color"
            disabled={isSubmitting}
          />
        </div>
        <Field
          label="Playoff Series Format"
          type="select"
          control={control}
          name="best_of_playoff"
          options={BEST_OF_OPTIONS}
          disabled={isSubmitting}
        />
        <Field
          label="Shootout Rounds"
          type="select"
          control={control}
          name="best_of_shootout"
          options={SHOOTOUT_OPTIONS}
          disabled={isSubmitting}
        />
        <Field
          label="Scoring System"
          type="select"
          control={control}
          name="scoring_system"
          options={SCORING_SYSTEM_OPTIONS}
          disabled={isSubmitting}
        />
        {/* ── Playoff Qualification Format ──────────────────────────────── */}
        <div className={styles.formatSection}>
          <span className={styles.formatLabel}>Playoff Qualification Format</span>
          <p className={styles.formatHint}>
            Rules are evaluated in order. Set group roles (Conference / Division) on the league
            groups to make scope-based rules work.
          </p>
          {formatRules.length === 0 && (
            <p className={styles.formatEmpty}>No rules set — qualification is managed manually.</p>
          )}
          {formatRules.map((rule, idx) => (
            <div
              key={idx}
              className={styles.formatRule}
            >
              <select
                className={styles.formatRuleSelect}
                value={rule.scope}
                onChange={(e) =>
                  updateRule(idx, { scope: e.target.value as PlayoffFormatRule['scope'] })
                }
                disabled={isSubmitting}
              >
                {SCOPE_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className={styles.formatRuleSelect}
                value={rule.method}
                onChange={(e) =>
                  updateRule(idx, { method: e.target.value as PlayoffFormatRule['method'] })
                }
                disabled={isSubmitting}
              >
                {METHOD_OPTIONS.map((o) => (
                  <option
                    key={o.value}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className={styles.formatRuleCount}
                value={rule.count}
                min={1}
                max={32}
                onChange={(e) =>
                  updateRule(idx, { count: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                disabled={isSubmitting}
              />
              <button
                type="button"
                className={styles.formatRuleDelete}
                onClick={() => removeRule(idx)}
                disabled={isSubmitting}
                aria-label="Remove rule"
              >
                <Icon
                  name="close"
                  size="0.85em"
                />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.formatRuleDelete}
            style={{ alignSelf: 'flex-start', width: 'auto', padding: '4px 10px', gap: '4px' }}
            onClick={addRule}
            disabled={isSubmitting}
          >
            <Icon
              name="add"
              size="0.85em"
            />
            Add Rule
          </button>
        </div>
        <Field
          label="Description"
          type="richtext"
          control={control}
          name="description"
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

export default LeagueEditModal;
