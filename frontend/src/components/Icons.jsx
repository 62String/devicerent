import React from 'react';

const Svg = ({ size = 16, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const DeviceIcon = (props) => (
  <Svg {...props}>
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <path d="M11 4h2M12 17v.01" />
  </Svg>
);

export const SearchIcon = (props) => (
  <Svg {...props}>
    <circle cx="10" cy="10" r="6" />
    <path d="M21 21l-6-6" />
  </Svg>
);

export const MoonIcon = (props) => (
  <Svg {...props}>
    <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
  </Svg>
);

export const SunIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const LogoutIcon = (props) => (
  <Svg {...props}>
    <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
    <path d="M9 12h12l-3-3M18 15l3-3" />
  </Svg>
);

export const XIcon = (props) => (
  <Svg {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

export const ClockIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Svg>
);

export const ChevronLeftIcon = (props) => (
  <Svg {...props}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const ChevronRightIcon = (props) => (
  <Svg {...props}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const DownloadIcon = (props) => (
  <Svg {...props}>
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    <path d="M12 4v12M7 11l5 5 5-5" />
  </Svg>
);

export const RefreshIcon = (props) => (
  <Svg {...props}>
    <path d="M20 11A8 8 0 0 0 6.5 6.5L4 9M4 13a8 8 0 0 0 13.5 4.5L20 15" />
    <path d="M4 5v4h4M20 19v-4h-4" />
  </Svg>
);

export const ScanIcon = (props) => (
  <Svg {...props}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M5 12h14" />
  </Svg>
);

export const AlertTriangleIcon = (props) => (
  <Svg {...props}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17v.01" />
  </Svg>
);

export const PlaneIcon = (props) => (
  <Svg {...props}>
    <path d="M10 4l9 6-9 6v-4l-6 1v-2l6 1V4z" />
  </Svg>
);

export const CheckCircleIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Svg>
);

export const CheckIcon = (props) => (
  <Svg {...props}>
    <path d="M5 12l5 5 9-11" />
  </Svg>
);
