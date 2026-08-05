import type { ReactNode } from "react"

type ToolCardProps = {
  description: string
  href: string
  icon: ReactNode
  title: string
}

export const ToolCard = ({
  description,
  href,
  icon,
  title,
}: ToolCardProps) => (
  <a
    href={href}
    className="block rounded-xl border border-border-default bg-surface-sunken p-7 transition-colors hover:border-border-strong hover:bg-surface-raised"
  >
    <div className="flex items-center gap-3">
      {icon}
      <h2 className="text-2xl font-semibold text-content-primary">
        {title}
      </h2>
    </div>
    <p className="mt-3 text-content-secondary leading-relaxed">
      {description}
    </p>
  </a>
)
