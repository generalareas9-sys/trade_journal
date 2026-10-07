import { FileUp } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function TradeCsvImport() {
  return <Link className="button-secondary" to="/import"><FileUp size={15} />Import CSV</Link>
}
