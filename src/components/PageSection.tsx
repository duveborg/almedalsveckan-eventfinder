import type { ElementType, HTMLAttributes, ReactNode } from "react";

type PageSectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
};

const BASE = "mx-auto w-full max-w-4xl";

export function PageSection({
  as: Component = "section",
  className,
  children,
  ...rest
}: PageSectionProps) {
  return (
    <Component
      className={className ? `${BASE} ${className}` : BASE}
      {...rest}
    >
      {children}
    </Component>
  );
}
