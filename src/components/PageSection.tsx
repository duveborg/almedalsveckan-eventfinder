import type { ElementType, HTMLAttributes, ReactNode } from "react";

type PageSectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
};

export function PageSection({
  as: Component = "section",
  className,
  children,
  ...rest
}: PageSectionProps) {
  return (
    <Component
      className={`mx-auto max-w-md md:max-w-2xl${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
