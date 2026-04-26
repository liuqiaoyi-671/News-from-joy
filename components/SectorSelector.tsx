'use client'
import { SECTORS } from '@/lib/news'

interface Props {
  selected: string
  onChange: (id: string) => void
}

export default function SectorSelector({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SECTORS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selected === s.id
              ? 'bg-accent text-white'
              : 'bg-bg-card border border-border text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}
