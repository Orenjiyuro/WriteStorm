import type { ReactElement } from 'react';
import { rendererText } from '../../i18n';

export type CustomTypeDisabledShellProps = {
  readonly idPrefix: string;
};

export function CustomTypeDisabledShell(
  props: CustomTypeDisabledShellProps,
): ReactElement {
  const titleId = `${props.idPrefix}-custom-type-title`;
  const reasonId = `${props.idPrefix}-custom-type-disabled-reason`;

  return (
    <aside className="custom-type-disabled-shell" aria-labelledby={titleId}>
      <div>
        <strong id={titleId}>{rendererText.customTypeDisabled.title}</strong>
        <span>{rendererText.customTypeDisabled.status}</span>
      </div>
      <button type="button" disabled aria-describedby={reasonId}>
        {rendererText.customTypeDisabled.copyBuiltInTemplate}
      </button>
      <p id={reasonId}>{rendererText.customTypeDisabled.reason}</p>
    </aside>
  );
}
