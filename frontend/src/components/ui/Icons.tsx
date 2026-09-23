import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PulseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12h4l2.2-6 4.3 12 2.3-6H21" />
  </IconBase>
);

export const AnnouncementIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 10h4l11-5v14L8 14H4zM8 10v4l2 6H6l-2-6M22 10v4" />
  </IconBase>
);

export const GridIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </IconBase>
);

export const PlusIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14M5 12h14" />
  </IconBase>
);

export const LogOutIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M10 17l5-5-5-5M15 12H3" />
    <path d="M14 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5" />
  </IconBase>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </IconBase>
);

export const ArrowRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </IconBase>
);

export const RefreshIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 6v5h-5" />
    <path d="M4 18v-5h5" />
    <path d="M6.1 9A7 7 0 0118.4 6L20 11M4 13l1.6 5A7 7 0 0017.9 15" />
  </IconBase>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M14 3h7v7M10 14L21 3" />
    <path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
  </IconBase>
);

export const EditIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z" />
  </IconBase>
);

export const TrashIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" />
  </IconBase>
);

export const GlobeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </IconBase>
);

export const ClockIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </IconBase>
);

export const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20 6L9 17l-5-5" />
  </IconBase>
);

export const AlertIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M10.3 3.9L2.5 18a2 2 0 001.8 3h15.4a2 2 0 001.8-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </IconBase>
);

export const ActivityIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12h4l2-7 4 14 2-7h6" />
  </IconBase>
);

export const MenuIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </IconBase>
);

export const CloseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </IconBase>
);
