import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Compressor } from '../types'

const RECENT_COMPRESSORS_KEY = 'capilarpro:recent_compressors'
const MAX_SUGGESTIONS = 8
const MAX_RECENT_COMPRESSORS = 8

type Suggestion =
  | {
      id: string
      label: string
      description: string
      kind: 'catalog'
      compressor: Compressor
    }
  | {
      id: string
      label: string
      description: string
      kind: 'recent'
    }

const readRecentCompressorLabels = (): string[] => {
  const stored = window.localStorage.getItem(RECENT_COMPRESSORS_KEY)
  if (!stored) return []

  try {
    const labels: unknown = JSON.parse(stored)
    if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string')) {
      throw new Error('El historial local de compresores tiene un formato inválido.')
    }
    return labels.slice(0, MAX_RECENT_COMPRESSORS)
  } catch (error) {
    console.error('No se pudo leer el historial local de compresores.', error)
    return []
  }
}

const saveRecentCompressorLabel = (label: string, currentLabels: string[]) => {
  const normalized = label.trim()
  if (!normalized || normalized.toLowerCase() === 'compresor personalizado') {
    return currentLabels
  }

  const nextLabels = [
    normalized,
    ...currentLabels.filter(
      (item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase(),
    ),
  ].slice(0, MAX_RECENT_COMPRESSORS)
  try {
    window.localStorage.setItem(
      RECENT_COMPRESSORS_KEY,
      JSON.stringify(nextLabels),
    )
  } catch (error) {
    console.error('No se pudo guardar el historial local de compresores.', error)
  }
  return nextLabels
}

export const CompressorSearch = ({
  compressors,
  value,
  onValueChange,
  onSelectCompressor,
}: {
  compressors: Compressor[]
  value: string
  onValueChange: (value: string) => void
  onSelectCompressor: (id: string) => void
}) => {
  const inputId = useId()
  const listboxId = useId()
  const blurTimeout = useRef<number | null>(null)
  const [recentLabels, setRecentLabels] = useState(readRecentCompressorLabels)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const displayValue = value === 'Compresor personalizado' ? '' : value
  const query = displayValue.trim().toLocaleLowerCase()

  const suggestions = useMemo<Suggestion[]>(() => {
    const catalogSuggestions = compressors
      .filter((compressor) => {
        const searchable = [
          compressor.brand,
          compressor.model,
          compressor.series,
          compressor.id,
        ]
          .join(' ')
          .toLocaleLowerCase()
        return !query || searchable.includes(query)
      })
      .map((compressor): Suggestion => ({
        id: `catalog-${compressor.id}`,
        label: `${compressor.brand} ${compressor.model}`,
        description: `${compressor.displacementCm3Rev} cm³/rev · ${compressor.refrigerants.join(' / ')}`,
        kind: 'catalog',
        compressor,
      }))

    const catalogLabels = new Set(
      catalogSuggestions.map((suggestion) => suggestion.label.toLocaleLowerCase()),
    )
    const recentSuggestions = recentLabels
      .filter((label) => {
        const normalized = label.toLocaleLowerCase()
        return (
          (!query || normalized.includes(query)) && !catalogLabels.has(normalized)
        )
      })
      .map(
        (label): Suggestion => ({
          id: `recent-${label.toLocaleLowerCase()}`,
          label,
          description: 'Compresor personalizado',
          kind: 'recent',
        }),
      )

    return [...catalogSuggestions, ...recentSuggestions].slice(
      0,
      MAX_SUGGESTIONS,
    )
  }, [compressors, query, recentLabels])

  const selectSuggestion = (suggestion: Suggestion) => {
    if (blurTimeout.current !== null) {
      window.clearTimeout(blurTimeout.current)
    }
    if (suggestion.kind === 'catalog') {
      onSelectCompressor(suggestion.compressor.id)
    } else {
      onValueChange(suggestion.label)
    }
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const commitCustomLabel = () => {
    setRecentLabels((current) =>
      saveRecentCompressorLabel(displayValue, current),
    )
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) =>
        current < 0 ? 0 : (current + 1) % suggestions.length,
      )
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const activeSuggestion = isOpen ? suggestions[activeIndex] : undefined
      if (activeSuggestion) {
        selectSuggestion(activeSuggestion)
      } else {
        commitCustomLabel()
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative">
      <label className="field-label" htmlFor={inputId}>
        Código o modelo del compresor
      </label>
      <div className="input-shell">
        <input
          id={inputId}
          type="text"
          value={displayValue}
          onChange={(event) => {
            onValueChange(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            blurTimeout.current = window.setTimeout(commitCustomLabel, 120)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ej. QD110H o buscar marca/modelo"
          className="input-base"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && activeIndex >= 0
              ? `${listboxId}-${suggestions[activeIndex]?.id}`
              : undefined
          }
        />
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Sugerencias de compresor"
          className="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink-900/10 bg-white p-1.5 shadow-xl"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-${suggestion.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-left ${
                index === activeIndex ? 'bg-mint-50' : 'hover:bg-frost-50'
              }`}
            >
              <span className="block text-[12px] font-semibold text-ink-900">
                {suggestion.label}
              </span>
              <span className="mt-0.5 block text-[10px] text-ink-600">
                {suggestion.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
