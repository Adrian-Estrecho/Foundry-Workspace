import type { ReactNode } from "react";
import { CheckboxChips, FieldGroup, FormRow, NativeSelect } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WIDE_TYPES, type BuiltinField, type FormField } from "../fields";

/**
 * One question of a public form: its label, help and control. The public
 * page and the form builder both draw fields with this, so the builder shows
 * exactly what visitors get.
 */
export function FieldControl({
  field,
  rules,
  value,
  error,
  timeZones = [],
}: {
  field: FormField;
  rules?: BuiltinField;
  value?: string | string[];
  error?: string;
  timeZones?: string[];
}) {
  const text = typeof value === "string" ? value : "";
  // Sized by the form's width (a container query), so the builder's phone preview lays out like a phone.
  const wide = WIDE_TYPES.includes(field.type) ? "@md:col-span-2" : undefined;
  const common = {
    id: `field-${field.id}`,
    name: field.id,
    placeholder: field.placeholder,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    autoComplete: rules?.autoComplete,
  };

  if (field.type === "multi_select") {
    return (
      <FieldGroup label={field.label} hint={field.help} error={error} required={field.required} className={wide}>
        <CheckboxChips name={field.id} options={field.options ?? []} defaultValue={Array.isArray(value) ? value : []} />
      </FieldGroup>
    );
  }

  let control: ReactNode;
  switch (field.type) {
    case "long_text":
    case "links":
      control = <Textarea {...common} rows={4} maxLength={rules?.maxLength} defaultValue={text} className="rounded-xl" />;
      break;
    case "select":
      control = (
        <NativeSelect {...common} defaultValue={text}>
          <option value="">Choose one</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </NativeSelect>
      );
      break;
    case "timezone": {
      const zones = !text || timeZones.includes(text) ? timeZones : [text, ...timeZones];
      control = (
        <NativeSelect {...common} defaultValue={text}>
          {!text && <option value="">Choose your timezone</option>}
          {zones.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </NativeSelect>
      );
      break;
    }
    case "number":
      control = (
        <Input
          {...common}
          type="number"
          inputMode={rules?.integer ? "numeric" : "decimal"}
          min={rules?.min}
          max={rules?.max}
          step={rules?.step ?? (rules?.integer ? 1 : "any")}
          defaultValue={text}
        />
      );
      break;
    case "date":
      control = <Input {...common} type="date" defaultValue={text} />;
      break;
    case "email":
      control = <Input {...common} type="email" maxLength={rules?.maxLength} defaultValue={text} />;
      break;
    case "url":
      control = <Input {...common} type="url" placeholder={field.placeholder ?? "https://"} defaultValue={text} />;
      break;
    case "phone":
      control = <Input {...common} type="tel" maxLength={rules?.maxLength ?? 40} defaultValue={text} />;
      break;
    default:
      control = <Input {...common} maxLength={rules?.maxLength ?? 200} defaultValue={text} />;
  }

  return (
    <FormRow label={field.label} hint={field.help} error={error} required={field.required} className={wide}>
      {control}
    </FormRow>
  );
}
