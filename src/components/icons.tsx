import type {SVGProps} from 'react';

export function SwiftdashLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22V12" />
      <path d="M12 12L2 6.5" />
      <path d="M12 12L22 6.5" />
      <path d="M12 12L2 17.5" />
      <path d="M12 12L22 17.5" />
      <path d="M12 2L2 6.5" />
      <path d="M12 2L22 6.5" />
    </svg>
  );
}
