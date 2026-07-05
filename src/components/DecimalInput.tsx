import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
  decimals?: number
}

function formatDecimal(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString().replace('.', ',')
}

/**
 * Zahleneingabe mit fester Nachkommastellenzahl, die während der Eingabe frei
 * bearbeitbar bleibt (auch leer), statt bei jedem Zwischenzustand auf 0 zu
 * springen, wie es ein natives <input type="number"> mit Number(value) tut.
 */
export default function DecimalInput({ value, onChange, decimals = 1, ...rest }: DecimalInputProps) {
  const [text, setText] = useState(() => formatDecimal(value, decimals))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatDecimal(value, decimals))
  }, [value, focused, decimals])

  const pattern = new RegExp(`^-?\\d*([.,]\\d{0,${decimals}})?$`)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw !== '' && !pattern.test(raw)) return
    setText(raw)
    const normalized = raw.replace(',', '.')
    if (normalized !== '' && normalized !== '-' && !normalized.endsWith('.')) {
      const parsed = Number(normalized)
      if (!Number.isNaN(parsed)) onChange(parsed)
    }
  }

  function handleBlur() {
    setFocused(false)
    const normalized = text.replace(',', '.').trim()
    const parsed = normalized === '' || normalized === '-' ? NaN : Number(normalized)
    setText(formatDecimal(Number.isNaN(parsed) ? value : parsed, decimals))
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}
