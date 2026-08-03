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
    className="block rounded-xl border border-slate-700/70 bg-slate-800/40 p-7 transition-colors hover:border-slate-600 hover:bg-slate-800/70"
  >
    <div className="flex items-center gap-3">
      {icon}
      <h2 className="text-2xl font-semibold text-slate-100">
        {title}
      </h2>
    </div>
    <p className="mt-3 text-slate-400 leading-relaxed">
      {description}
    </p>
  </a>
)
