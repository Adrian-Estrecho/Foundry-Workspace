import { builtinOf, type FormField, type FormKind } from "../fields";
import type { FormValues } from "../submission";
import { FieldControl } from "./field-control";

/** Fields grouped under the section headings that come before them. */
export function groupBySection(fields: FormField[]) {
  const groups: { section: FormField | null; fields: FormField[] }[] = [];
  for (const field of fields) {
    if (field.type === "section") groups.push({ section: field, fields: [] });
    else if (groups.length === 0) groups.push({ section: null, fields: [field] });
    else groups.at(-1)!.fields.push(field);
  }
  return groups;
}

/**
 * A public form's fields, laid out in its sections: two columns once the
 * form is wide enough. Put it inside an `@container`.
 */
export function FormFields({
  kind,
  fields,
  values,
  errors,
  timeZones,
}: {
  kind: FormKind;
  fields: FormField[];
  values?: FormValues;
  errors?: Record<string, string>;
  timeZones?: string[];
}) {
  return groupBySection(fields).map((group, index) => (
    <fieldset key={group.section?.id ?? `group-${index}`} className="grid grid-cols-1 gap-5 @md:grid-cols-2">
      {group.section && (
        <>
          <legend className="mb-4 font-heading text-lg font-medium">{group.section.label}</legend>
          {group.section.help && <p className="-mt-2 text-sm text-muted-foreground @md:col-span-2">{group.section.help}</p>}
        </>
      )}
      {group.fields.map((field) => {
        const value = values?.[field.id];
        return (
          <FieldControl
            // A timezone filled in after load (the visitor's own) needs a fresh select.
            key={field.type === "timezone" ? `${field.id}:${String(value ?? "")}` : field.id}
            field={field}
            rules={builtinOf(kind, field.id)}
            value={value}
            error={errors?.[field.id]}
            timeZones={timeZones}
          />
        );
      })}
    </fieldset>
  ));
}
