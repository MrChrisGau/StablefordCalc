import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'

interface OptionalIntInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | undefined
  onChange: (value: number | undefined) => void
}

/**
 * Ganzzahl-Eingabe, die leer bleiben kann (= kein Wert gesetzt), statt wie
 * DecimalInput auf einen Zahlenwert zurückzufallen — für optionale Felder wie
 * Par-Overrides, bei denen "leer" eine eigene Bedeutung hat (kein Override).
 */
export default function OptionalIntInput({ value, onChange, ...rest }: OptionalIntInputProps) {
  const [text, setText] = useState(() => (value === undefined ? '' : String(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value === undefined ? '' : String(value))
  }, [value, focused])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw !== '' && !/^\d*$/.test(raw)) return
    setText(raw)
    if (raw === '') {
      onChange(undefined)
      return
    }
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) onChange(parsed)
  }

  function handleBlur() {
    setFocused(false)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}
