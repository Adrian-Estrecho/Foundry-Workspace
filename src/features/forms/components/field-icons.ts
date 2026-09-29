import {
  AlignLeftIcon,
  AtSignIcon,
  CalendarIcon,
  GlobeIcon,
  HashIcon,
  HeadingIcon,
  Link2Icon,
  LinkIcon,
  ListChecksIcon,
  PhoneIcon,
  SquareChevronDownIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type { FieldType } from "../fields";

export const FIELD_ICONS: Record<FieldType, LucideIcon> = {
  section: HeadingIcon,
  short_text: TypeIcon,
  long_text: AlignLeftIcon,
  select: SquareChevronDownIcon,
  multi_select: ListChecksIcon,
  url: LinkIcon,
  number: HashIcon,
  date: CalendarIcon,
  email: AtSignIcon,
  phone: PhoneIcon,
  links: Link2Icon,
  timezone: GlobeIcon,
};
