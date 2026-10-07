import { ChevronDown } from 'lucide-react'
import { ranges } from '../utils/trading'

export default function DateRangePicker({ value, onChange, start, onStartChange, end, onEndChange }) {
  return <div className="date-range-wrap">
    <label className="range-select">
      <select aria-label="Date range" value={value} onChange={(event) => onChange(event.target.value)}>
        {ranges.map((item) => <option key={item}>{item}</option>)}
      </select>
      <ChevronDown size={14} />
    </label>
    {value === 'Custom' && <div className="custom-range-popover">
      <label>From<input type="date" aria-label="Custom start date" value={start} max={end} onChange={(event) => onStartChange(event.target.value)} /></label>
      <label>To<input type="date" aria-label="Custom end date" value={end} min={start} onChange={(event) => onEndChange(event.target.value)} /></label>
    </div>}
  </div>
}
