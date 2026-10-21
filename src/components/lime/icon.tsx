import type {LucideIcon} from 'lucide-react';
import {cn} from '@/lib/lime/utils';

// The one place Lime imports icons from. Components import from here, never from the icon package, so
// the set can be swapped in one file.
//
// Lucide (lucide-react, ISC), as Spendly uses, not Lime's IBM Carbon. Lime's own names are kept as
// aliases so its components still import what they expect; the names after them are this app's, under
// Lucide's own names. One stroke on a 24 grid: pass a size, 12, 16, 20 or 24.
// To use another glyph, add its Lucide name to this list.
export {
  Plus as Add, ArrowDown, ArrowRight, ArrowUp, Paperclip as Attachment, Check as Checkmark,
  CircleCheck as CheckmarkFilled, ChevronDown, ChevronRight, ChevronsUpDown as ChevronSort, ChevronUp, X as Close,
  Copy, CircleX as ErrorFilled, Image, Info as Information, Menu, Play, Receipt, RefreshCw as Renew, Search, Send,
  Minus as Subtract, Clock as Time, Upload, Wallet, PiggyBank, TriangleAlert as Warning, TriangleAlert as WarningFilled,
  ChevronLeft, ArrowLeft, Pause, Ellipsis as OverflowMenuHorizontal, Folder, Star, Plus, Trash2 as Delete, Coffee as Cafe,
  ShoppingBag, Bell as Notification, Lock as Locked, Undo, Pencil as Edit, CircleDashed as CircleDash, MapPin as Location,
  Moon, Sun, CalendarDays, ChartLine, LogOut, ListChecks, PanelLeftOpen, PanelLeftClose
} from 'lucide-react';

export type LimeIcon = LucideIcon;

type IconProps = Omit<React.ComponentProps<LucideIcon>, 'size'> & {
  /** The icon, imported from this file. */
  icon: LimeIcon;
  /** px. 12, 16, 20, 24 or 32. */
  size?: 12 | 16 | 20 | 24 | 32;
  /** Accessible name. Without one the icon is decorative and hidden from assistive tech. */
  label?: string;
};

export function Icon({icon: Glyph, size = 16, label, className, ...props}: IconProps) {
  return <Glyph
    size={size}
    aria-hidden={label ? undefined : true}
    aria-label={label}
    role={label ? 'img' : undefined}
    className={cn('shrink-0', className)}
    {...props}
  />;
}
